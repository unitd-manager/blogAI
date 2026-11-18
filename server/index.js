import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initializeDatabase } from './db.js';
import { generateArticle } from './workflow.js';
import { researchWebsite, researchChosenTopic } from './research.js';
import { getAiMode, isAiEnabled, requestContext } from './ai.js';
import { rateLimit, limits } from './rateLimit.js';

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
app.use(cors()); app.use(express.json({ limit: '1mb' }));
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
app.get('/api/health', async (_req, res) => {
  const mode = getAiMode(); let localAiAvailable = false;
  if (mode === 'ollama') { try { const local = await fetch((process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/v1\/?$/, '/api/tags'), { signal: AbortSignal.timeout(1200) }); localAiAvailable = local.ok; } catch { localAiAvailable = false; } }
  const aiConfigured = isAiEnabled();
  res.json({ ok: true, aiMode: mode, aiConfigured, aiReady: mode === 'ollama' ? localAiAvailable : aiConfigured, localAiAvailable, researchConfigured: Boolean(process.env.TAVILY_API_KEY) && mode !== 'free' });
});
app.get('/api/articles', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM articles ORDER BY updated_at DESC LIMIT 50');
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
// ---- Team writing settings (brand voice + audience), used in every article prompt ----
const SETTING_KEYS = { brandVoice: 500, audience: 300 };
async function readSettings() {
  try {
    const [rows] = await pool.query('SELECT name, value FROM settings');
    const out = { brandVoice: '', audience: '' };
    for (const row of rows) if (row.name in SETTING_KEYS) out[row.name] = String(row.value || '');
    return out;
  } catch { return { brandVoice: '', audience: '' }; }
}
app.get('/api/settings', async (_req, res) => res.json(await readSettings()));
app.put('/api/settings', async (req, res) => {
  const body = req.body || {};
  const values = {};
  try {
    for (const [key, max] of Object.entries(SETTING_KEYS)) values[key] = (optionalString(body[key], key === 'brandVoice' ? 'Brand voice' : 'Target audience', max) || '').trim();
  } catch (e) { return res.status(400).json({ error: publicError(e, 'Invalid request.') }); }
  try {
    for (const [name, value] of Object.entries(values)) await pool.query('INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [name, value]);
    res.json(values);
  } catch { res.status(503).json({ error: 'Could not save settings' }); }
});
app.post('/api/analyze', rateLimit({ name: 'analyze', perHour: limits.analyzePerHour() }), async (req, res) => {
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
app.post('/api/articles', rateLimit({ name: 'articles', perHour: limits.articlesPerHour() }), async (req, res) => {
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
    const { research, result } = await requestContext.run({ signal }, async () => {
      const research = await researchChosenTopic({ topic, keyword, websiteUrl: context, siteSources: sources });
      const { brandVoice, audience } = await readSettings();
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
        'INSERT INTO articles (project_id,website,title,topic,keyword,related_keywords_json,keyword_strategy_json,meta_data_json,content,sources_json,evidence_review_json,word_count,seo_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)',
        [projectId, context || null, topic, topic, keyword, JSON.stringify(keywordIdeas), strategyData, metaDataStr, content, sourceData, reviewData, content.split(/\s+/).filter(Boolean).length]
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
app.patch('/api/articles/:id', async (req, res) => {
  if (!/^\d{1,10}$/.test(req.params.id)) return res.status(404).json({ error: 'Article not found' });
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
    const [r] = await pool.query(
      'UPDATE articles SET title=COALESCE(?,title),content=COALESCE(?,content),status=COALESCE(?,status),meta_data_json=COALESCE(?,meta_data_json),website=COALESCE(?,website),word_count=IF(? IS NULL,word_count,?) WHERE id=?',
      [title ?? null, content ?? null, status ?? null, metaStr, website || null, content ?? null, content ? content.split(/\s+/).filter(Boolean).length : 0, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Could not save article' });
  }
});
app.delete('/api/articles/:id', async (req, res) => {
  if (!/^\d{1,10}$/.test(req.params.id)) return res.status(404).json({ error: 'Article not found' });
  try {
    const [r] = await pool.query('DELETE FROM articles WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Could not delete article' });
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
const port = Number(process.env.PORT || 4000); if (!isTest) initializeDatabase().then(() => app.listen(port, () => console.log(`SignalWrite API listening on ${port}`))).catch(e => { console.error('MySQL connection failed:', e.message); app.listen(port, () => console.log(`SignalWrite API listening on ${port} (database unavailable)`)); });

