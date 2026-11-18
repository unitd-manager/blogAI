import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let api;
before(async () => { api = await startApp({ RATE_LIMIT_ANALYZE_PER_HOUR: '1000', RATE_LIMIT_ARTICLES_PER_HOUR: '1000', RATE_LIMIT_DAILY_TOTAL: '1000' }); });
after(() => api.close());

// Every error must be a short JSON message: no stack traces, file paths or account ids.
function assertCleanError(res, status, messagePattern) {
  assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${res.text.slice(0, 120)}`);
  assert.ok(res.json && typeof res.json.error === 'string', 'error must be JSON { error }');
  if (messagePattern) assert.match(res.json.error, messagePattern);
  assert.doesNotMatch(res.text, /node_modules|at \w+ \(|<pre>|org_[A-Za-z0-9]/);
}

test('health check responds', async () => {
  const res = await api.call('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
});

test('analyze: missing or wrong-type URL is rejected', async () => {
  assertCleanError(await api.call('POST', '/api/analyze', {}), 400, /required/i);
  assertCleanError(await api.call('POST', '/api/analyze', { url: '   ' }), 400, /required/i);
  assertCleanError(await api.call('POST', '/api/analyze', { url: 123 }), 400, /must be text/i);
  assertCleanError(await api.call('POST', '/api/analyze', { url: ['https://a.com'] }), 400, /must be text/i);
  assertCleanError(await api.call('POST', '/api/analyze', { url: 'https://a.com/' + 'a'.repeat(2100) }), 400, /too long/i);
});

test('analyze: non-website addresses are rejected', async () => {
  for (const url of ['javascript:alert(1)', 'http://', 'https://exa mple.com']) {
    assertCleanError(await api.call('POST', '/api/analyze', { url }), 400, /website address/i);
  }
  for (const url of ['ftp://example.com', 'file:///etc/passwd', 'https://user:pw@example.com']) {
    assertCleanError(await api.call('POST', '/api/analyze', { url }), 400, /public http or https/i);
  }
});

test('analyze: private and internal addresses are blocked (SSRF)', async () => {
  const blocked = [
    'localhost', 'http://127.0.0.1:3306', 'http://10.0.0.1', '192.168.1.1', '169.254.169.254',
    'http://2130706433/', 'http://[::1]/', 'http://[::ffff:a9fe:a9fe]/', 'http://[::ffff:169.254.169.254]/'
  ];
  for (const url of blocked) {
    assertCleanError(await api.call('POST', '/api/analyze', { url }), 400, /not a public website/i);
  }
});

test('articles: topic and field types are validated', async () => {
  assertCleanError(await api.call('POST', '/api/articles', {}), 400, /Topic is required/);
  assertCleanError(await api.call('POST', '/api/articles', { topic: 42 }), 400, /must be text/);
  assertCleanError(await api.call('POST', '/api/articles', { topic: 'a'.repeat(400) }), 400, /too long/);
  assertCleanError(await api.call('POST', '/api/articles', { topic: 'x', keywordStrategy: 'text' }), 400, /must be an object/);
  assertCleanError(await api.call('POST', '/api/articles', { topic: 'x', relatedKeywords: 'a,b' }), 400, /must be a list/);
  assertCleanError(await api.call('POST', '/api/articles', { topic: 'x', context: 'http://' }), 400, /website address/i);
});

test('article update and delete: bad ids and bad fields are rejected', async () => {
  for (const id of ['abc', '-1', '99999999999', '1%20OR%201=1']) {
    assertCleanError(await api.call('PATCH', `/api/articles/${id}`, { title: 'x' }), 404);
    assertCleanError(await api.call('DELETE', `/api/articles/${id}`), 404);
  }
  assertCleanError(await api.call('PATCH', '/api/articles/1', { content: { a: 1 } }), 400, /must be text/);
  assertCleanError(await api.call('PATCH', '/api/articles/1', { status: 5 }), 400, /must be text/);
  assertCleanError(await api.call('PATCH', '/api/articles/1', { metaData: [1] }), 400, /must be an object/);
  assertCleanError(await api.call('PATCH', '/api/articles/1', { website: 'javascript:alert(1)' }), 400, /website address/i);
});

test('valid article ids pass validation and reach the database (503 here: tests have no database)', async () => {
  assertCleanError(await api.call('DELETE', '/api/articles/12'), 503, /Could not delete/);
  assertCleanError(await api.call('PATCH', '/api/articles/12', { title: 'x', website: 'example.com' }), 503, /Could not save/);
  assertCleanError(await api.call('PUT', '/api/settings', { brandVoice: 'Friendly', audience: 'Founders' }), 503, /Could not save settings/);
  const settings = await api.call('GET', '/api/settings');
  assert.equal(settings.status, 200);
  assert.deepEqual(settings.json, { brandVoice: '', audience: '' });
});

test('settings: wrong types and oversized values are rejected', async () => {
  assertCleanError(await api.call('PUT', '/api/settings', { brandVoice: 123 }), 400, /must be text/);
  assertCleanError(await api.call('PUT', '/api/settings', { audience: ['a'] }), 400, /must be text/);
  assertCleanError(await api.call('PUT', '/api/settings', { brandVoice: 'a'.repeat(501) }), 400, /too long/);
});

test('broken JSON, huge bodies and unknown routes get clean JSON errors', async () => {
  assertCleanError(await api.call('POST', '/api/analyze', '{"url":', { raw: true }), 400, /not valid JSON/);
  assertCleanError(await api.call('POST', '/api/analyze', JSON.stringify({ url: 'a'.repeat(1_100_000) }), { raw: true }), 413, /too large/);
  assertCleanError(await api.call('GET', '/api/nothing-here'), 404, /Not found/);
  assertCleanError(await api.call('DELETE', '/api/articles'), 404, /Not found/);
});
