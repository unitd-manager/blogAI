import express from 'express';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initializeDatabase } from './db.js';
import { generateArticle } from './workflow.js';
import { researchWebsite, researchChosenTopic } from './research.js';
import { getAiMode, isAiEnabled, requestContext } from './ai.js';
import { rateLimit, limits } from './rateLimit.js';
import {
  hashPassword, verifyPassword, burnPasswordCheck, makeTempPassword, setSessionCookie, clearSessionCookie,
  loadUser, requireUser, requireActive, requireAdmin, publicProfile, accountStatus, isAdminEmail, adminEmails, trialDays
} from './auth.js';

// Abort signal that fires if the browser disconnects before we answer (tab closed, client timeout, proxy cut-off).
function disconnectSignal(res) {
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableFinished) controller.abort(); });
  return controller.signal;
}

export const app = express();
// Behind a reverse proxy (nginx etc.) on the same machine, read the visitor's real IP from X-Forwarded-For
// so rate limits apply per visitor, not to the proxy. Set TRUST_PROXY in .env for other setups.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
// No cors(): the page and the API share one origin, so other websites get no access to the API.
app.use(express.json({ limit: '1mb' }));
app.use('/api', loadUser);
app.use(requireUser);
const parseStoredJson = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };

// ---- Input validation helpers ----
class BadRequest extends Error {}
const optionalString = (value, name, max) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BadRequest(`${name} must be text.`);
  if (value.length > max) throw new BadRequest(`${name} is too long (max ${max} characters).`);
  return value;
};
const requiredString = (value, name, max) => {
  const text = optionalString(value, name, max)?.trim();
  if (!text) throw new BadRequest(`${name} is required.`);
  return text;
};
const optionalArray = (value, name, max) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequest(`${name} must be a list.`);
  return value.slice(0, max);
};
const optionalObject = (value, name, maxJsonChars) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new BadRequest(`${name} must be an object.`);
  if (JSON.stringify(value).length > maxJsonChars) throw new BadRequest(`${name} is too large.`);
  return value;
};
// People usually type "buffer.com" without https:// — add it for them.
const normalizeWebsiteUrl = (raw) => {
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  try { new URL(url); } catch { throw new BadRequest('That does not look like a website address. Try something like example.com.'); }
  return url;
};
const validEmail = (value) => {
  const email = requiredString(value, 'Email', 191).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new BadRequest('Enter a valid email address.');
  return email;
};
const validNewPassword = (value) => {
  if (typeof value !== 'string') throw new BadRequest('Password is required.');
  if (value.length < 8) throw new BadRequest('Password must be at least 8 characters.');
  if (value.length > 200) throw new BadRequest('Password is too long (max 200 characters).');
  return value;
};
const validId = (value) => (/^\d{1,10}$/.test(String(value)) ? Number(value) : null);

// Turn internal/provider errors into messages that are safe and useful to show in the browser.
// Full details stay in the server log.
function publicError(error, fallback) {
  const message = String(error?.message || '');
  const code = error?.cause?.code || error?.code || '';
  if (error instanceof BadRequest) return message;
  if (/ENOTFOUND|EAI_AGAIN/.test(code + message)) return 'We could not find that website. Check the address and try again.';
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/.test(code + message)) return 'That website refused the connection or is offline. Try again later.';
  if (/\b(429|413)\b|rate limit|request too large|tokens per minute/i.test(message)) return 'The AI service is busy right now (free-tier limit). Please wait a minute and try again.';
  if (/\b401\b|invalid api key|incorrect api key/i.test(message)) return 'The AI service rejected the API key. Check the server configuration.';
  if (/does not exist or you do not have access|model_not_found|decommissioned/i.test(message)) return 'The configured AI model is not available. Check OPENAI_MODEL in the server configuration.';
  if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) return fallback;
  // Our own research/workflow errors are written for users; strip anything that looks like an account/org id.
  return message.replace(/org_[A-Za-z0-9]+/g, '[account]').slice(0, 300) || fallback;
}

// Which articles a user may see: their own; admins also see articles from before accounts existed.
const ownerClause = (user) => (isAdminEmail(user.email) ? { sql: '(user_id = ? OR user_id IS NULL)', args: [user.id] } : { sql: 'user_id = ?', args: [user.id] });

// ---- Accounts ----
app.post('/api/signup', rateLimit({ name: 'signup', perHour: limits.signupsPerHour(), countsTowardDaily: false, message: 'Too many sign-ups from this network.' }), async (req, res) => {
  let email, password, name;
  try {
    const body = req.body || {};
    email = validEmail(body.email);
    password = validNewPassword(body.password);
    name = optionalString(body.name, 'Name', 120)?.trim() || null;
  } catch (e) { return res.status(400).json({ error: publicError(e, 'Invalid request.') }); }
  try {
    const passwordHash = await hashPassword(password);
    const trialEnds = new Date(Date.now() + trialDays() * 24 * 60 * 60 * 1000);
    const [r] = await pool.query('INSERT INTO users (email, name, password_hash, trial_ends_at) VALUES (?, ?, ?, ?)', [email, name, passwordHash, trialEnds]);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
    await setSessionCookie(req, res, rows[0]);
    console.log(`[signup] new account #${r.insertId}${isAdminEmail(email) ? ' (admin)' : ''}`);
    res.status(201).json(publicProfile(rows[0]));
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    console.warn('[signup] failed:', e.message);
    res.status(503).json({ error: 'Could not create the account. Please try again.' });
  }
});

app.post('/api/login', rateLimit({ name: 'login', perHour: limits.loginsPer15Min(), windowMs: 15 * 60 * 1000, countsTowardDaily: false, message: 'Too many login attempts.' }), async (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 191) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    const ok = user ? await verifyPassword(password, user.password_hash) : await burnPasswordCheck(password);
    if (!user || !ok) return res.status(401).json({ error: 'Wrong email or password.' });
    if (accountStatus(user) === 'disabled') return res.status(403).json({ error: 'This account is disabled. Please contact support.' });
    await setSessionCookie(req, res, user);
    res.json(publicProfile(user));
  } catch (e) {
    console.warn('[login] failed:', e.message);
    res.status(503).json({ error: 'Could not log in right now. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => { clearSessionCookie(req, res); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json(publicProfile(req.user)));

app.get('/api/health', async (_req, res) => {
  const mode = getAiMode(); let localAiAvailable = false;
  if (mode === 'ollama') { try { const local = await fetch((process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/v1\/?$/, '/api/tags'), { signal: AbortSignal.timeout(1200) }); localAiAvailable = local.ok; } catch { localAiAvailable = false; } }
  const aiConfigured = isAiEnabled();
  res.json({ ok: true, aiMode: mode, aiConfigured, aiReady: mode === 'ollama' ? localAiAvailable : aiConfigured, localAiAvailable, researchConfigured: Boolean(process.env.TAVILY_API_KEY) && mode !== 'free' });
});

app.get('/api/articles', async (req, res) => {
  try {
    const owner = ownerClause(req.user);
    const [rows] = await pool.query(`SELECT * FROM articles WHERE ${owner.sql} ORDER BY updated_at DESC LIMIT 100`, owner.args);
    res.json(rows.map((row) => ({
      ...row,
      sources: parseStoredJson(row.sources_json, []),
      relatedKeywords: parseStoredJson(row.related_keywords_json, []),
      keywordStrategy: parseStoredJson(row.keyword_strategy_json, null),
      metaData: parseStoredJson(row.meta_data_json, null),
      evidenceReview: parseStoredJson(row.evidence_review_json, null)
    })));
  } catch {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ---- Writing settings (brand voice + audience) per account, used in every article prompt ----
const SETTING_KEYS = { brandVoice: 500, audience: 300 };
async function readSettings(userId) {
  const out = { brandVoice: '', audience: '' };
  try {
    const [rows] = await pool.query('SELECT name, value FROM user_settings WHERE user_id = ?', [userId]);
    for (const row of rows) if (row.name in SETTING_KEYS) out[row.name] = String(row.value || '');
  } catch { /* defaults */ }
  return out;
}
app.get('/api/settings', async (req, res) => res.json(await readSettings(req.user.id)));
app.put('/api/settings', requireActive, async (req, res) => {
  const body = req.body || {};
  const values = {};
  try {
    for (const [key, max] of Object.entries(SETTING_KEYS)) values[key] = (optionalString(body[key], key === 'brandVoice' ? 'Brand voice' : 'Target audience', max) || '').trim();
  } catch (e) { return res.status(400).json({ error: publicError(e, 'Invalid request.') }); }
  try {
    for (const [name, value] of Object.entries(values)) await pool.query('INSERT INTO user_settings (user_id, name, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [req.user.id, name, value]);
    res.json(values);
  } catch { res.status(503).json({ error: 'Could not save settings' }); }
});

app.post('/api/analyze', requireActive, rateLimit({ name: 'analyze', perHour: limits.analyzePerHour() }), async (req, res) => {
  let input;
  try {
    const body = req.body || {};
    input = {
      url: normalizeWebsiteUrl(requiredString(body.url, 'Website URL', 2048)),
      existingBlogs: optionalString(body.existingBlogs, 'Existing blog content', 20_000) || '',
      extraContext: optionalString(body.extraContext, 'Extra context', 5_000) || ''
    };
  } catch (e) { return res.status(400).json({ error: publicError(e, 'Invalid request.') }); }
  const signal = disconnectSignal(res);
  try { res.json(await requestContext.run({ signal }, () => researchWebsite(input))); }
  catch (e) {
    console.warn('[analyze] failed:', e?.message, e?.cause?.code || '');
    res.status(400).json({ error: publicError(e, 'Unable to analyze that website. Please try again.') });
  }
});

app.post('/api/articles', requireActive, rateLimit({ name: 'articles', perHour: limits.articlesPerHour() }), async (req, res) => {
  let topic, keyword, keywordIdeas, keywordStrategy, internalLinks, projectId, context, sources;
  try {
    const body = req.body || {};
    topic = requiredString(body.topic, 'Topic', 300);
    keyword = optionalString(body.keyword, 'Keyword', 200)?.trim() || topic;
    keywordIdeas = [...new Set(optionalArray(body.relatedKeywords, 'Related keywords', 20)
      .map((term) => (typeof term === 'object' && term ? term.keyword : term))
      .filter((term) => typeof term === 'string')
      .map((term) => term.trim().slice(0, 80)).filter(Boolean))].slice(0, 4);
    keywordStrategy = optionalObject(body.keywordStrategy, 'Keyword strategy', 20_000);
    internalLinks = optionalArray(body.internalLinks, 'Internal links', 20)
      .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
      .map((l) => ({ url: l.url.slice(0, 500), title: String(l.title || l.url).slice(0, 200), path: String(l.path || '').slice(0, 300) }))
      .slice(0, 6);
    projectId = Number.isInteger(body.projectId) && body.projectId > 0 ? body.projectId : null;
    context = optionalString(body.context, 'Website', 2048)?.trim() || '';
    if (context) context = normalizeWebsiteUrl(context);
    sources = optionalArray(body.sources, 'Sources', 40).filter((s) => s && typeof s === 'object' && typeof s.url === 'string');
  } catch (e) { return res.status(400).json({ error: publicError(e, 'Invalid request.') }); }
  const signal = disconnectSignal(res);
  try {
    const { brandVoice, audience } = await readSettings(req.user.id);
    const { research, result } = await requestContext.run({ signal }, async () => {
      const research = await researchChosenTopic({ topic, keyword, websiteUrl: context, siteSources: sources });
      const result = await generateArticle({ topic, keyword, relatedKeywords: keywordIdeas, keywordStrategy, internalLinks, context, sources: research.sources, brandVoice, audience });
      return { research, result };
    });
    // Browser already gave up: don't save a copy it will never see (its retry would create a duplicate).
    if (signal.aborted) return;
    const content = String(result.content);
    const sourceData = JSON.stringify(result.sources || []);
    const reviewData = JSON.stringify(result.evidenceReview || null);
    const strategyData = JSON.stringify(result.keywordStrategy || keywordStrategy || null);
    const metaDataStr = JSON.stringify(result.metaData || null);
    let insertId = null;
    try {
      const [saved] = await pool.query(
        'INSERT INTO articles (user_id,project_id,website,title,topic,keyword,related_keywords_json,keyword_strategy_json,meta_data_json,content,sources_json,evidence_review_json,word_count,seo_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
        [req.user.id, projectId, context || null, topic, topic, keyword, JSON.stringify(keywordIdeas), strategyData, metaDataStr, content, sourceData, reviewData, content.split(/\s+/).filter(Boolean).length]
      );
      insertId = saved.insertId;
    } catch (dbErr) {
      console.warn('Article saved in session only (database error):', dbErr.message);
    }
    res.status(201).json({
      id: insertId,
      website: context || null,
      title: topic,
      keyword,
      relatedKeywords: keywordIdeas,
      keywordStrategy: result.keywordStrategy || keywordStrategy || null,
      metaData: result.metaData || null,
      faqSchema: result.faqSchema || null,
      repurposed: result.repurposed || null,
      content,
      sources: result.sources || [],
      evidenceReview: result.evidenceReview || null,
      seoOptimization: result.seo || null,
      researchWarning: research.warning,
      word_count: content.split(/\s+/).filter(Boolean).length,
      status: 'Draft'
    });
  } catch (e) {
    console.warn('[articles] generation failed:', e?.message);
    res.status(503).json({ error: publicError(e, 'Could not generate the article. Please try again.') });
  }
});

app.patch('/api/articles/:id', requireActive, async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Article not found' });
  let title, content, status, metaData, website;
  try {
    const body = req.body || {};
    title = optionalString(body.title, 'Title', 500);
    content = optionalString(body.content, 'Content', 500_000);
    status = optionalString(body.status, 'Status', 40);
    metaData = optionalObject(body.metaData, 'SEO meta data', 10_000);
    website = optionalString(body.website, 'Website', 500)?.trim();
    if (website) website = normalizeWebsiteUrl(website);
  } catch (e) { return res.status(400).json({ error: publicError(e, 'Invalid request.') }); }
  try {
    const metaStr = metaData ? JSON.stringify(metaData) : null;
    const owner = ownerClause(req.user);
    const [r] = await pool.query(
      `UPDATE articles SET title=COALESCE(?,title),content=COALESCE(?,content),status=COALESCE(?,status),meta_data_json=COALESCE(?,meta_data_json),website=COALESCE(?,website),word_count=IF(? IS NULL,word_count,?) WHERE id=? AND ${owner.sql}`,
      [title ?? null, content ?? null, status ?? null, metaStr, website || null, content ?? null, content ? content.split(/\s+/).filter(Boolean).length : 0, id, ...owner.args]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Could not save article' });
  }
});

// Deleting stays allowed after the trial: people may always remove their own data.
app.delete('/api/articles/:id', async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Article not found' });
  try {
    const owner = ownerClause(req.user);
    const [r] = await pool.query(`DELETE FROM articles WHERE id = ? AND ${owner.sql}`, [id, ...owner.args]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Could not delete article' });
  }
});

// ---- Admin: see customers, extend trials, activate subscriptions (payment is collected outside the app) ----
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT u.*, (SELECT COUNT(*) FROM articles a WHERE a.user_id = u.id) AS article_count
      FROM users u ORDER BY u.created_at DESC LIMIT 500`);
    res.json(rows.map((u) => ({ ...publicProfile(u), createdAt: u.created_at, disabled: Boolean(u.disabled), articleCount: Number(u.article_count) })));
  } catch {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

const ADMIN_ACTIONS = new Set(['extend_trial', 'activate', 'deactivate', 'disable', 'enable', 'reset_password']);
app.post('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(404).json({ error: 'User not found' });
  const action = req.body?.action;
  if (!ADMIN_ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown action.' });
  const days = req.body?.days === undefined ? (action === 'extend_trial' ? 7 : 30) : Number(req.body.days);
  if (!Number.isInteger(days) || days < 1 || days > 3660) return res.status(400).json({ error: 'Days must be a whole number from 1 to 3660.' });
  if (id === req.user.id && (action === 'disable' || action === 'reset_password')) return res.status(400).json({ error: 'You cannot do that to your own account here.' });
  try {
    const [found] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!found[0]) return res.status(404).json({ error: 'User not found' });
    let tempPassword;
    if (action === 'extend_trial') await pool.query('UPDATE users SET trial_ends_at = DATE_ADD(GREATEST(NOW(), trial_ends_at), INTERVAL ? DAY) WHERE id = ?', [days, id]);
    if (action === 'activate') await pool.query('UPDATE users SET subscription_until = DATE_ADD(GREATEST(NOW(), COALESCE(subscription_until, NOW())), INTERVAL ? DAY) WHERE id = ?', [days, id]);
    if (action === 'deactivate') await pool.query('UPDATE users SET subscription_until = NULL WHERE id = ?', [id]);
    if (action === 'disable') await pool.query('UPDATE users SET disabled = 1, session_version = session_version + 1 WHERE id = ?', [id]);
    if (action === 'enable') await pool.query('UPDATE users SET disabled = 0 WHERE id = ?', [id]);
    if (action === 'reset_password') {
      tempPassword = makeTempPassword();
      await pool.query('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [await hashPassword(tempPassword), id]);
    }
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    console.log(`[admin] #${req.user.id} did ${action} on user #${id}`);
    res.json({ user: { ...publicProfile(rows[0]), disabled: Boolean(rows[0].disabled) }, ...(tempPassword ? { tempPassword } : {}) });
  } catch (e) {
    console.warn('[admin] action failed:', e.message);
    res.status(503).json({ error: 'Could not update the user' });
  }
});

// Unknown API routes get a JSON 404 instead of the web page.
app.all('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
// Malformed JSON, oversized bodies and any other unexpected error: short JSON message, never a stack trace.
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
  console.error('[server] Unexpected error:', err);
  res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: 'Something went wrong. Please try again.' });
});
// Start listening only when run as the server (tests import `app` without starting it).
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
if (!isTest && adminEmails().size === 0) console.warn('[auth] ADMIN_EMAILS is not set: nobody gets admin access or free use. Add your email(s) to ADMIN_EMAILS in .env.');
const port = Number(process.env.PORT || 4000); if (!isTest) initializeDatabase().then(() => app.listen(port, () => console.log(`SignalWrite API listening on ${port}`))).catch(e => { console.error('MySQL connection failed:', e.message); app.listen(port, () => console.log(`SignalWrite API listening on ${port} (database unavailable)`)); });
