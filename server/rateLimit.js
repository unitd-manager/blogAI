// Small in-memory rate limiter for the AI routes. Every AI call costs Groq/Tavily credits, so without
// a limit one person (or a script) could use up the whole quota. Limits are per visitor IP per hour,
// plus one shared daily cap for everyone together. Adjust them in .env.
//
// In-memory is enough for a single server process; counters reset when the server restarts.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

function minutesText(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

// Shared daily cap across all routes and visitors (protects the monthly bill).
const daily = { count: 0, resetAt: Date.now() + DAY };

/**
 * @param {object} options
 * @param {string} options.name   label used in log lines
 * @param {number} options.perHour max requests per IP per hour
 */
export function rateLimit({ name, perHour }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Drop expired entries now and then so the map doesn't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, 10 * 60 * 1000).unref();

  return (req, res, next) => {
    const now = Date.now();
    const dailyLimit = envNumber('RATE_LIMIT_DAILY_TOTAL', 300);
    if (daily.resetAt <= now) { daily.count = 0; daily.resetAt = now + DAY; }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + HOUR }; hits.set(ip, entry); }

    res.setHeader('RateLimit-Limit', String(perHour));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, perHour - entry.count - 1)));

    if (entry.count >= perHour) {
      const wait = entry.resetAt - now;
      res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
      console.warn(`[rate-limit] ${name}: ${ip} hit ${perHour}/hour`);
      return res.status(429).json({ error: `Too many requests. You can try again in ${minutesText(wait)}.` });
    }
    if (daily.count >= dailyLimit) {
      const wait = daily.resetAt - now;
      res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
      console.warn(`[rate-limit] daily total of ${dailyLimit} reached`);
      return res.status(429).json({ error: `Today's AI usage limit for this tool has been reached. Try again in ${minutesText(wait)}.` });
    }

    entry.count += 1;
    daily.count += 1;
    next();
  };
}

export const limits = {
  analyzePerHour: () => envNumber('RATE_LIMIT_ANALYZE_PER_HOUR', 15),
  articlesPerHour: () => envNumber('RATE_LIMIT_ARTICLES_PER_HOUR', 30)
};
