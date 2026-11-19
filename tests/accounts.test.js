// Accounts: sign-up, login, sessions, per-customer data, 14-day trial, read-only after trial, admin.
import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, assertCleanError as clean } from './helpers.js';

const api = await startApp('accounts', { RATE_LIMIT_SIGNUPS_PER_HOUR: '100', RATE_LIMIT_LOGINS_PER_15MIN: '40' });
const err = (res, status, pattern) => clean(assert, res, status, pattern);

describe('accounts, trial and admin', { skip: api.unavailable }, () => {
  after(() => api.close());

  test('without logging in, data, AI and admin routes are locked', async () => {
    for (const [method, path] of [['GET', '/api/me'], ['GET', '/api/articles'], ['POST', '/api/analyze'], ['POST', '/api/articles'],
      ['GET', '/api/settings'], ['PUT', '/api/settings'], ['DELETE', '/api/articles/1'], ['PATCH', '/api/articles/1'], ['GET', '/api/admin/users']]) {
      err(await api.call(method, path, method === 'GET' || method === 'DELETE' ? undefined : {}), 401, /log in/i);
    }
  });

  test('sign-up validates input and refuses duplicate emails (case-insensitive)', async () => {
    err(await api.call('POST', '/api/signup', { email: 'not-an-email', password: 'long-enough-1' }), 400, /valid email/);
    err(await api.call('POST', '/api/signup', { email: 'a@test.local', password: 'short' }), 400, /at least 8/);
    err(await api.call('POST', '/api/signup', { email: 'a@test.local', password: 12345678 }), 400, /Password is required/);
    err(await api.call('POST', '/api/signup', { email: 'a@test.local', password: 'x'.repeat(201) }), 400, /too long/);
    err(await api.call('POST', '/api/signup', { email: 'a@test.local', password: 'long-enough-1', name: 5 }), 400, /must be text/);
    const { user } = await api.signup('Dup@Test.Local');
    assert.equal(user.email, 'dup@test.local');
    err(await api.call('POST', '/api/signup', { email: 'DUP@test.local', password: 'another-pass-1' }), 409, /already exists/);
  });

  test('new account: 14-day trial, can write, password stored as a hash only', async () => {
    const { user } = await api.signup('new@test.local', 'my-secret-pass-1');
    assert.equal(user.status, 'trial');
    assert.equal(user.canWrite, true);
    assert.equal(user.trialDaysLeft, 14);
    assert.equal(user.plan.price, '₹999/month');
    assert.equal(user.password_hash, undefined, 'never send the hash to the browser');
    const [row] = await api.query('SELECT password_hash FROM users WHERE email = ?', ['new@test.local']);
    assert.match(row.password_hash, /^scrypt\$/);
    assert.doesNotMatch(row.password_hash, /my-secret-pass-1/);
  });

  test('login: wrong email or password refused the same way; right password gives a safe cookie', async () => {
    await api.signup('login@test.local', 'right-password-1');
    err(await api.call('POST', '/api/login', { email: 'login@test.local', password: 'wrong-password' }), 401, /Wrong email or password/);
    err(await api.call('POST', '/api/login', { email: 'nobody@test.local', password: 'right-password-1' }), 401, /Wrong email or password/);
    err(await api.call('POST', '/api/login', { email: 'login@test.local' }), 400, /email and password/);
    const res = await api.call('POST', '/api/login', { email: ' LOGIN@test.local ', password: 'right-password-1' });
    assert.equal(res.status, 200);
    const header = res.headers.get('set-cookie');
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.doesNotMatch(header, /right-password-1/);
    assert.equal((await api.call('GET', '/api/me', undefined, { cookie: api.cookieFrom(res) })).json.email, 'login@test.local');
  });

  test('forged, tampered or expired session cookies are refused', async () => {
    const { cookie } = await api.signup('cookie@test.local');
    const [name, value] = cookie.split('=');
    const [id, ver, expiry, sig] = value.split('.');
    const forged = [
      `${name}=1.${ver}.${expiry}.${sig}`, // someone else's id
      `${name}=${id}.${ver}.${Date.now() + 9e9}.${sig}`, // longer expiry
      `${name}=${id}.${ver}.${expiry}.${sig.slice(0, -2)}xx`, // changed signature
      `${name}=${id}.${ver}.${Date.now() - 1000}.${sig}`, // expired
      `${name}=${id}`, `${name}=`, `${name}=a.b.c.d`, 'other=1'
    ];
    for (const c of forged) err(await api.call('GET', '/api/me', undefined, { cookie: c }), 401);
  });

  test('logout clears the cookie', async () => {
    const res = await api.call('POST', '/api/logout');
    assert.match(res.headers.get('set-cookie'), /sw_session=;.*Max-Age=0/);
  });

  test("customers only see and change their own articles", async () => {
    const a = await api.signup('alice@test.local');
    const b = await api.signup('bob@test.local');
    await api.query('INSERT INTO articles (user_id, title, content) VALUES (?, ?, ?), (NULL, ?, ?)', [a.user.id, 'Alice post', '# A', 'Old shared post', '# Old']);
    const [alicePost] = await api.query('SELECT id FROM articles WHERE user_id = ?', [a.user.id]);
    const titles = async (c) => (await api.call('GET', '/api/articles', undefined, { cookie: c })).json.map((x) => x.title);
    assert.deepEqual(await titles(a.cookie), ['Alice post']);
    assert.deepEqual(await titles(b.cookie), [], 'Bob must not see Alice or old shared posts');
    err(await api.call('PATCH', `/api/articles/${alicePost.id}`, { title: 'hacked' }, { cookie: b.cookie }), 404);
    err(await api.call('DELETE', `/api/articles/${alicePost.id}`, undefined, { cookie: b.cookie }), 404);
    const [still] = await api.query('SELECT title FROM articles WHERE id = ?', [alicePost.id]);
    assert.equal(still.title, 'Alice post');
    // Settings are per account too.
    await api.call('PUT', '/api/settings', { brandVoice: 'Alice voice' }, { cookie: a.cookie });
    assert.equal((await api.call('GET', '/api/settings', undefined, { cookie: b.cookie })).json.brandVoice, '');
  });

  test('after the trial: read-only (view, delete) but no AI, edits or settings', async () => {
    const { cookie, user } = await api.signup('expired@test.local');
    await api.query('INSERT INTO articles (user_id, title, content) VALUES (?, ?, ?), (?, ?, ?)', [user.id, 'Keep me', '# K', user.id, 'Delete me', '# D']);
    await api.query('UPDATE users SET trial_ends_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE id = ?', [user.id]);
    const me = (await api.call('GET', '/api/me', undefined, { cookie })).json;
    assert.equal(me.status, 'expired');
    assert.equal(me.canWrite, false);
    for (const [method, path, body] of [['POST', '/api/analyze', { url: 'example.com' }], ['POST', '/api/articles', { topic: 'x' }], ['PUT', '/api/settings', {}], ['PATCH', '/api/articles/1', { title: 'x' }]]) {
      const res = await api.call(method, path, body, { cookie });
      err(res, 402, /free trial has ended.*sales@test\.local/);
      assert.equal(res.json.subscriptionRequired, true);
    }
    const list = (await api.call('GET', '/api/articles', undefined, { cookie })).json;
    assert.equal(list.length, 2, 'articles stay visible');
    const del = list.find((x) => x.title === 'Delete me');
    assert.equal((await api.call('DELETE', `/api/articles/${del.id}`, undefined, { cookie })).status, 200, 'deleting own data stays allowed');
  });

  test('admin emails: never asked to subscribe, even with an old trial date', async () => {
    const { cookie, user } = await api.signup('admin@test.local');
    assert.equal(user.status, 'admin');
    await api.query('UPDATE users SET trial_ends_at = UTC_TIMESTAMP() - INTERVAL 400 DAY WHERE id = ?', [user.id]);
    const me = (await api.call('GET', '/api/me', undefined, { cookie })).json;
    assert.equal(me.status, 'admin');
    assert.equal(me.canWrite, true);
    err(await api.call('POST', '/api/analyze', {}, { cookie }), 400, /required/i); // passes the subscription check
  });

  test('admin: lists customers; customers cannot use admin routes', async () => {
    const admin = await api.call('POST', '/api/login', { email: 'admin@test.local', password: 'test-password-1' });
    const cookie = api.cookieFrom(admin);
    const users = (await api.call('GET', '/api/admin/users', undefined, { cookie })).json;
    assert.ok(users.length >= 5);
    assert.ok(users.every((u) => u.password_hash === undefined && u.email));
    const customer = await api.signup('nosy@test.local');
    err(await api.call('GET', '/api/admin/users', undefined, { cookie: customer.cookie }), 403, /Only admins/);
    err(await api.call('POST', `/api/admin/users/${customer.user.id}`, { action: 'activate' }, { cookie: customer.cookie }), 403);
  });

  test('admin actions: activate, extend trial, end subscription, validation', async () => {
    const cookie = api.cookieFrom(await api.call('POST', '/api/login', { email: 'admin@test.local', password: 'test-password-1' }));
    const [target] = await api.query("SELECT id FROM users WHERE email = 'expired@test.local'");
    const act = (body) => api.call('POST', `/api/admin/users/${target.id}`, body, { cookie });
    err(await act({ action: 'make_me_rich' }), 400, /Unknown action/);
    err(await act({ action: 'activate', days: 0 }), 400, /Days must be/);
    err(await act({ action: 'activate', days: 'ten' }), 400, /Days must be/);
    err(await api.call('POST', '/api/admin/users/999999', { action: 'activate' }, { cookie }), 404);

    let res = await act({ action: 'activate', days: 30 });
    assert.equal(res.json.user.status, 'active');
    assert.equal(res.json.user.subscriptionDaysLeft, 30);
    res = await act({ action: 'activate', days: 30 }); // renewing adds on top
    assert.equal(res.json.user.subscriptionDaysLeft, 60);
    const customer = api.cookieFrom(await api.call('POST', '/api/login', { email: 'expired@test.local', password: 'test-password-1' }));
    err(await api.call('POST', '/api/analyze', {}, { cookie: customer }), 400, /required/i); // can write again

    res = await act({ action: 'deactivate' });
    assert.equal(res.json.user.status, 'expired');
    res = await act({ action: 'extend_trial', days: 7 });
    assert.equal(res.json.user.status, 'trial');
    assert.equal(res.json.user.trialDaysLeft, 7);
  });

  test('admin: disable blocks login and ends sessions; reset password gives a working temp password', async () => {
    const adminCookie = api.cookieFrom(await api.call('POST', '/api/login', { email: 'admin@test.local', password: 'test-password-1' }));
    const victim = await api.signup('reset@test.local', 'original-pass-1');
    const act = (action) => api.call('POST', `/api/admin/users/${victim.user.id}`, { action }, { cookie: adminCookie });

    assert.equal((await act('disable')).status, 200);
    err(await api.call('GET', '/api/me', undefined, { cookie: victim.cookie }), 401);
    err(await api.call('POST', '/api/login', { email: 'reset@test.local', password: 'original-pass-1' }), 403, /disabled/);
    assert.equal((await act('enable')).status, 200);

    const fresh = api.cookieFrom(await api.call('POST', '/api/login', { email: 'reset@test.local', password: 'original-pass-1' }));
    const res = await act('reset_password');
    assert.match(res.json.tempPassword, /^[A-Za-z0-9_-]{12}$/);
    err(await api.call('GET', '/api/me', undefined, { cookie: fresh }), 401); // old session ended
    err(await api.call('POST', '/api/login', { email: 'reset@test.local', password: 'original-pass-1' }), 401);
    assert.equal((await api.call('POST', '/api/login', { email: 'reset@test.local', password: res.json.tempPassword })).status, 200);

    const self = (await api.call('GET', '/api/me', undefined, { cookie: adminCookie })).json;
    err(await api.call('POST', `/api/admin/users/${self.id}`, { action: 'disable' }, { cookie: adminCookie }), 400, /own account/);
  });

  test('password guessing is slowed down: blocked once the login limit is used up', async () => {
    let res, tries = 0;
    do { res = await api.call('POST', '/api/login', { email: 'login@test.local', password: 'guess' + tries }); tries++; } while (res.status === 401 && tries < 60);
    assert.ok(tries <= 41, `blocked after ${tries} tries`);
    err(res, 429, /Too many login attempts/);
    err(await api.call('POST', '/api/login', { email: 'login@test.local', password: 'right-password-1' }), 429);
  });
});
