// Small in-memory rate limiter. Every AI call costs Groq/Tavily credits, so without limits one
// account (or a script) could use up the whole quota.
//  - Per-route limit per hour, counted per logged-in user (or per IP before login).
//  - Daily AI limit per user (RATE_LIMIT_DAILY_PER_USER).
//  - Daily AI limit for the whole tool (RATE_LIMIT_DAILY_TOTAL), protecting the monthly bill.
// Counters live in memory and reset when the server restarts (fine for a single server process).

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

function minutesText(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes >= 120) return `${Math.ceil(minutes / 60)} hours`;
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

function counterStore() {
  const map = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of map) if (entry.resetAt <= now) map.delete(key);
  }, 10 * 60 * 1000).unref();
  return {
    get(key, windowMs) {
      const now = Date.now();
      let entry = map.get(key);
      if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + windowMs }; map.set(key, entry); }
      return entry;
    }
  };
}

const dailyPerUser = counterStore();
const dailyTotal = { count: 0, resetAt: Date.now() + DAY };

const visitorKey = (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`);

/**
 * @param {object} options
 * @param {string} options.name   label used in log lines
 * @param {number} options.perHour max requests per visitor per window (default window: 1 hour)
 * @param {number} [options.windowMs] window length
 * @param {boolean} [options.countsTowardDaily] true for AI routes; false for login/signup
 * @param {string} [options.message] custom 429 message
 */
export function rateLimit({ name, perHour, windowMs = HOUR, countsTowardDaily = true, message }) {
  const hits = counterStore();

  return (req, res, next) => {
    const now = Date.now();
    const key = visitorKey(req);
    const entry = hits.get(key, windowMs);

    const block = (wait, text, log) => {
      res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
      console.warn(`[rate-limit] ${log}`);
      return res.status(429).json({ error: `${text} You can try again in ${minutesText(wait)}.` });
    };

    res.setHeader('RateLimit-Limit', String(perHour));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, perHour - entry.count - 1)));
    if (entry.count >= perHour) return block(entry.resetAt - now, message || 'Too many requests.', `${name}: ${key} hit ${perHour}`);

    if (countsTowardDaily) {
      const perUserLimit = envNumber('RATE_LIMIT_DAILY_PER_USER', 60);
      const totalLimit = envNumber('RATE_LIMIT_DAILY_TOTAL', 1000);
      const mine = dailyPerUser.get(key, DAY);
      if (dailyTotal.resetAt <= now) { dailyTotal.count = 0; dailyTotal.resetAt = now + DAY; }
      if (mine.count >= perUserLimit) return block(mine.resetAt - now, "You've reached today's limit for AI requests on your account.", `daily per-user ${perUserLimit} reached by ${key}`);
      if (dailyTotal.count >= totalLimit) return block(dailyTotal.resetAt - now, "Today's AI usage limit for this tool has been reached.", `daily total ${totalLimit} reached`);
      mine.count += 1;
      dailyTotal.count += 1;
    }

    entry.count += 1;
    next();
  };
}

export const limits = {
  analyzePerHour: () => envNumber('RATE_LIMIT_ANALYZE_PER_HOUR', 15),
  articlesPerHour: () => envNumber('RATE_LIMIT_ARTICLES_PER_HOUR', 30),
  // New accounts per network per hour: stops someone creating many free trials to use up AI credits.
  signupsPerHour: () => envNumber('RATE_LIMIT_SIGNUPS_PER_HOUR', 5),
  // Login attempts per network per 15 minutes (slows down password guessing).
  loginsPer15Min: () => envNumber('RATE_LIMIT_LOGINS_PER_15MIN', 10)
};
