// Login turned on with a test-only password (separate process from the other test files).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

const TEST_PASSWORD = 'test-only-password-123';
let api;
before(async () => { api = await startApp({ APP_PASSWORD: TEST_PASSWORD }); });
after(() => api.close());

const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('without logging in, data and AI routes are locked', async () => {
  for (const [method, path] of [['GET', '/api/articles'], ['POST', '/api/analyze'], ['POST', '/api/articles'], ['GET', '/api/settings'], ['PUT', '/api/settings'], ['DELETE', '/api/articles/1'], ['PATCH', '/api/articles/1']]) {
    const res = await api.call(method, path, method === 'GET' || method === 'DELETE' ? undefined : {});
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.match(res.json.error, /log in/i);
  }
});

test('health and session stay open, and session says login is needed', async () => {
  assert.equal((await api.call('GET', '/api/health')).status, 200);
  const s = await api.call('GET', '/api/session');
  assert.deepEqual(s.json, { loginRequired: true, loggedIn: false });
});

test('wrong, empty or non-text passwords are refused without a cookie', async () => {
  for (const password of ['wrong', '', TEST_PASSWORD + ' ', TEST_PASSWORD.toUpperCase(), 123, null, ['x']]) {
    const res = await api.call('POST', '/api/login', { password });
    assert.equal(res.status, 401, String(password));
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('correct password gives a safe session cookie that unlocks the API', async () => {
  const res = await api.call('POST', '/api/login', { password: TEST_PASSWORD });
  assert.equal(res.status, 200);
  const header = res.headers.get('set-cookie');
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Max-Age=2592000/);
  assert.doesNotMatch(header, new RegExp(TEST_PASSWORD), 'cookie must not contain the password');
  const cookie = cookieFrom(res);
  assert.deepEqual((await api.call('GET', '/api/session', undefined, { cookie })).json, { loginRequired: true, loggedIn: true });
  // Unlocked: now the route runs its own validation instead of answering 401.
  assert.equal((await api.call('POST', '/api/analyze', {}, { cookie })).status, 400);
});

test('forged, tampered or expired cookies are refused', async () => {
  const good = cookieFrom(await api.call('POST', '/api/login', { password: TEST_PASSWORD }));
  const [name, value] = good.split('=');
  const [expiry, sig] = value.split('.');
  const forged = [
    `${name}=${Date.now() + 9e9}.${sig}`, // later expiry, old signature
    `${name}=${expiry}.${sig.slice(0, -2)}xx`, // changed signature
    `${name}=${expiry}`, `${name}=`, `${name}=abc.def`, 'other=1'
  ];
  for (const cookie of forged) assert.equal((await api.call('GET', '/api/articles', undefined, { cookie })).status, 401, cookie);
  const expired = `${name}=${Date.now() - 1000}.${sig}`;
  assert.equal((await api.call('GET', '/api/articles', undefined, { cookie: expired })).status, 401);
});

test('logout clears the cookie', async () => {
  const res = await api.call('POST', '/api/logout');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /sw_session=;.*Max-Age=0/);
});

test('password guessing is slowed down: blocked after 10 tries in 15 minutes', async () => {
  // Earlier tests in this file already used some attempts; keep going until blocked.
  let res;
  for (let i = 0; i < 12; i++) res = await api.call('POST', '/api/login', { password: 'guess' + i });
  assert.equal(res.status, 429);
  assert.match(res.json.error, /Too many login attempts/);
  // Even the right password is refused while blocked.
  assert.equal((await api.call('POST', '/api/login', { password: TEST_PASSWORD })).status, 429);
});
