// Runs in its own process with its own test database and low limits.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

const api = await startApp('ratelimit', { RATE_LIMIT_ANALYZE_PER_HOUR: '3', RATE_LIMIT_ARTICLES_PER_HOUR: '50', RATE_LIMIT_DAILY_PER_USER: '6', RATE_LIMIT_DAILY_TOTAL: '1000', RATE_LIMIT_SIGNUPS_PER_HOUR: '3' });

describe('rate limits', { skip: api.unavailable }, () => {
  let alice, bob;
  before(async () => { alice = (await api.signup('alice@test.local')).cookie; bob = (await api.signup('bob@test.local')).cookie; });
  after(() => api.close());

  test('analyze: each account is blocked after its own hourly limit, with Retry-After', async () => {
    // Invalid requests: no AI credits spent, but they still count toward the limit.
    for (let i = 0; i < 3; i++) assert.equal((await api.call('POST', '/api/analyze', {}, { cookie: alice })).status, 400);
    const res = await api.call('POST', '/api/analyze', {}, { cookie: alice });
    assert.equal(res.status, 429);
    assert.match(res.json.error, /Too many requests.*try again in \d+ minutes?/i);
    assert.ok(Number(res.headers.get('retry-after')) > 0);
    assert.equal((await api.call('POST', '/api/analyze', {}, { cookie: bob })).status, 400, "Bob's limit is separate");
  });

  test('daily limit per account covers all AI routes', async () => {
    // Alice used 3 analyze calls; 3 more article calls reach her daily limit of 6.
    for (let i = 0; i < 3; i++) assert.equal((await api.call('POST', '/api/articles', {}, { cookie: alice })).status, 400);
    const res = await api.call('POST', '/api/articles', {}, { cookie: alice });
    assert.equal(res.status, 429);
    assert.match(res.json.error, /today's limit/i);
  });

  test('sign-ups are limited per network (stops mass free-trial accounts)', async () => {
    // alice + bob used 2 of 3.
    assert.equal((await api.call('POST', '/api/signup', { email: 'carol@test.local', password: 'test-password-1' })).status, 201);
    const res = await api.call('POST', '/api/signup', { email: 'dave@test.local', password: 'test-password-1' });
    assert.equal(res.status, 429);
    assert.match(res.json.error, /Too many sign-ups/);
  });

  test('non-AI routes are not rate limited', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await api.call('GET', '/api/articles', undefined, { cookie: alice })).status, 200);
    assert.equal((await api.call('GET', '/api/health')).status, 200);
  });
});
