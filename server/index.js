import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initializeDatabase } from './db.js';
import { generateArticle } from './workflow.js';
import { researchWebsite, researchChosenTopic } from './research.js';
import { getAiMode, isAiEnabled } from './ai.js';

const app = express(); app.use(cors()); app.use(express.json({ limit: '1mb' }));
const parseStoredJson = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
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
app.post('/api/analyze', async (req, res) => {
  const { url, existingBlogs = '', extraContext = '' } = req.body || {}; if (!url) return res.status(400).json({ error: 'Website URL is required' });
  try { res.json(await researchWebsite({ url, existingBlogs, extraContext })); }
  catch (e) { res.status(400).json({ error: e.message || 'Unable to analyze website' }); }
});
app.post('/api/articles', async (req, res) => {
  const { topic, keyword = topic, relatedKeywords = [], keywordStrategy = null, internalLinks = [], projectId = null, context = '', sources = [] } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Topic is required' });
  const keywordIdeas = Array.isArray(relatedKeywords) ? [...new Set(relatedKeywords.map((term) => String(term).trim().slice(0, 80)).filter(Boolean))].slice(0, 4) : [];
  try {
    const research = await researchChosenTopic({ topic, keyword, websiteUrl: context, siteSources: sources });
    const result = await generateArticle({ topic, keyword, relatedKeywords: keywordIdeas, keywordStrategy, internalLinks, context, sources: research.sources });
    const content = String(result.content);
    const sourceData = JSON.stringify(result.sources || []);
    const reviewData = JSON.stringify(result.evidenceReview || null);
    const strategyData = JSON.stringify(result.keywordStrategy || keywordStrategy || null);
    const metaDataStr = JSON.stringify(result.metaData || null);
    let insertId = null;
    try {
      const [saved] = await pool.query(
        'INSERT INTO articles (project_id,title,topic,keyword,related_keywords_json,keyword_strategy_json,meta_data_json,content,sources_json,evidence_review_json,word_count,seo_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)',
        [projectId, topic, topic, keyword, JSON.stringify(keywordIdeas), strategyData, metaDataStr, content, sourceData, reviewData, content.split(/\s+/).filter(Boolean).length]
      );
      insertId = saved.insertId;
    } catch (dbErr) {
      console.warn('Article saved in session only (database error):', dbErr.message);
    }
    res.status(201).json({
      id: insertId,
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
      researchWarning: research.warning,
      word_count: content.split(/\s+/).filter(Boolean).length,
      status: 'Draft'
    });
  } catch (e) {
    res.status(503).json({ error: e.message || 'Could not generate article' });
  }
});
app.patch('/api/articles/:id', async (req, res) => {
  try {
    const { title, content, status, metaData } = req.body;
    const metaStr = metaData ? JSON.stringify(metaData) : null;
    const [r] = await pool.query(
      'UPDATE articles SET title=COALESCE(?,title),content=COALESCE(?,content),status=COALESCE(?,status),meta_data_json=COALESCE(?,meta_data_json),word_count=IF(? IS NULL,word_count,?) WHERE id=?',
      [title ?? null, content ?? null, status ?? null, metaStr, content ?? null, content ? content.split(/\s+/).filter(Boolean).length : 0, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Could not save article' });
  }
});
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
const port = Number(process.env.PORT || 4000); initializeDatabase().then(() => app.listen(port, () => console.log(`SignalWrite API listening on ${port}`))).catch(e => { console.error('MySQL connection failed:', e.message); app.listen(port, () => console.log(`SignalWrite API listening on ${port} (database unavailable)`)); });

