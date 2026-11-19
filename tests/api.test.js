import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, assertCleanError as clean } from './helpers.js';

const api = await startApp('api', { RATE_LIMIT_ANALYZE_PER_HOUR: '1000', RATE_LIMIT_ARTICLES_PER_HOUR: '1000', RATE_LIMIT_DAILY_PER_USER: '1000', RATE_LIMIT_DAILY_TOTAL: '1000', RATE_LIMIT_SIGNUPS_PER_HOUR: '100' });
const err = (res, status, pattern) => clean(assert, res, status, pattern);

describe('API validation and security', { skip: api.unavailable }, () => {
  let cookie;
  const as = (method, path, body, opts = {}) => api.call(method, path, body, { cookie, ...opts });
  before(async () => { ({ cookie } = await api.signup('admin@test.local')); });
  after(() => api.close());

  test('health check responds without login', async () => {
    const res = await api.call('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
  });

  test('analyze: missing or wrong-type URL is rejected', async () => {
    err(await as('POST', '/api/analyze', {}), 400, /required/i);
    err(await as('POST', '/api/analyze', { url: '   ' }), 400, /required/i);
    err(await as('POST', '/api/analyze', { url: 123 }), 400, /must be text/i);
    err(await as('POST', '/api/analyze', { url: ['https://a.com'] }), 400, /must be text/i);
    err(await as('POST', '/api/analyze', { url: 'https://a.com/' + 'a'.repeat(2100) }), 400, /too long/i);
  });

  test('analyze: non-website addresses are rejected', async () => {
    for (const url of ['javascript:alert(1)', 'http://', 'https://exa mple.com']) err(await as('POST', '/api/analyze', { url }), 400, /website address/i);
    for (const url of ['ftp://example.com', 'file:///etc/passwd', 'https://user:pw@example.com']) err(await as('POST', '/api/analyze', { url }), 400, /public http or https/i);
  });

  test('analyze: private and internal addresses are blocked (SSRF)', async () => {
    const blocked = ['localhost', 'http://127.0.0.1:3306', 'http://10.0.0.1', '192.168.1.1', '169.254.169.254',
      'http://2130706433/', 'http://[::1]/', 'http://[::ffff:a9fe:a9fe]/', 'http://[::ffff:169.254.169.254]/'];
    for (const url of blocked) err(await as('POST', '/api/analyze', { url }), 400, /not a public website/i);
  });

  test('articles: topic and field types are validated', async () => {
    err(await as('POST', '/api/articles', {}), 400, /Topic is required/);
    err(await as('POST', '/api/articles', { topic: 42 }), 400, /must be text/);
    err(await as('POST', '/api/articles', { topic: 'a'.repeat(400) }), 400, /too long/);
    err(await as('POST', '/api/articles', { topic: 'x', keywordStrategy: 'text' }), 400, /must be an object/);
    err(await as('POST', '/api/articles', { topic: 'x', relatedKeywords: 'a,b' }), 400, /must be a list/);
    err(await as('POST', '/api/articles', { topic: 'x', context: 'http://' }), 400, /website address/i);
  });

  test('article update and delete: bad ids and bad fields are rejected', async () => {
    for (const id of ['abc', '-1', '99999999999', '1%20OR%201=1', '999999']) {
      err(await as('PATCH', `/api/articles/${id}`, { title: 'x' }), 404);
      err(await as('DELETE', `/api/articles/${id}`), 404);
    }
    err(await as('PATCH', '/api/articles/1', { content: { a: 1 } }), 400, /must be text/);
    err(await as('PATCH', '/api/articles/1', { status: 5 }), 400, /must be text/);
    err(await as('PATCH', '/api/articles/1', { metaData: [1] }), 400, /must be an object/);
    err(await as('PATCH', '/api/articles/1', { website: 'javascript:alert(1)' }), 400, /website address/i);
  });

  test('article update, website and delete work end to end', async () => {
    const me = (await as('GET', '/api/me')).json;
    await api.query('INSERT INTO articles (user_id, title, content) VALUES (?, ?, ?)', [me.id, 'Old title', '# Old']);
    const [row] = await api.query('SELECT id FROM articles WHERE user_id = ?', [me.id]);
    assert.equal((await as('PATCH', `/api/articles/${row.id}`, { title: 'New title', content: '# New\n\nthree more words', website: 'example.com' })).status, 200);
    const [saved] = await api.query('SELECT title, website, word_count FROM articles WHERE id = ?', [row.id]);
    assert.deepEqual({ ...saved }, { title: 'New title', website: 'https://example.com', word_count: 5 });
    assert.equal((await as('DELETE', `/api/articles/${row.id}`)).status, 200);
    assert.equal((await api.query('SELECT id FROM articles WHERE id = ?', [row.id])).length, 0);
    err(await as('DELETE', `/api/articles/${row.id}`), 404);
  });

  test('settings: saved per account; wrong types and oversized values are rejected', async () => {
    err(await as('PUT', '/api/settings', { brandVoice: 123 }), 400, /must be text/);
    err(await as('PUT', '/api/settings', { audience: ['a'] }), 400, /must be text/);
    err(await as('PUT', '/api/settings', { brandVoice: 'a'.repeat(501) }), 400, /too long/);
    assert.equal((await as('PUT', '/api/settings', { brandVoice: ' Friendly ', audience: 'Bakers' })).status, 200);
    assert.deepEqual((await as('GET', '/api/settings')).json, { brandVoice: 'Friendly', audience: 'Bakers' });
  });

  test('broken JSON, huge bodies and unknown routes get clean JSON errors', async () => {
    err(await as('POST', '/api/analyze', '{"url":', { raw: true }), 400, /not valid JSON/);
    err(await as('POST', '/api/analyze', JSON.stringify({ url: 'a'.repeat(1_100_000) }), { raw: true }), 413, /too large/);
    err(await as('GET', '/api/nothing-here'), 404, /Not found/);
    err(await as('DELETE', '/api/articles'), 404, /Not found/);
  });
});
