// Runs in its own process (node --test isolates files), so these low limits don't affect other tests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let api;
before(async () => { api = await startApp({ RATE_LIMIT_ANALYZE_PER_HOUR: '3', RATE_LIMIT_ARTICLES_PER_HOUR: '5', RATE_LIMIT_DAILY_TOTAL: '7' }); });
after(() => api.close());

test('analyze: blocked after the hourly limit, with a clear message and Retry-After', async () => {
  // Invalid requests are used so no AI credits are spent; they still count toward the limit.
  for (let i = 0; i < 3; i++) assert.equal((await api.call('POST', '/api/analyze', {})).status, 400);
  const res = await api.call('POST', '/api/analyze', {});
  assert.equal(res.status, 429);
  assert.match(res.json.error, /Too many requests.*try again in \d+ minutes?/i);
  assert.ok(Number(res.headers.get('retry-after')) > 0);
});

test('articles has its own hourly limit, and the shared daily cap applies to everyone', async () => {
  // 3 analyze requests already counted toward the daily total of 7, so 4 more are allowed.
  for (let i = 0; i < 4; i++) assert.equal((await api.call('POST', '/api/articles', {})).status, 400);
  const res = await api.call('POST', '/api/articles', {});
  assert.equal(res.status, 429);
  assert.match(res.json.error, /usage limit for this tool/i);
});

test('non-AI routes are not rate limited', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await api.call('GET', '/api/health')).status, 200);
  assert.equal((await api.call('PATCH', '/api/articles/abc', { title: 'x' })).status, 404);
});
