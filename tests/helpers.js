// Test helpers: start the app on a random port with its own throw-away MySQL database.
//
// Each test file gets a separate database named signalwrite_test_<name>, created fresh at the start.
// Your real database (MYSQL_DATABASE in .env) is never used. AI routes are only called with
// invalid input, so the tests never spend Groq/Tavily credits.
import 'dotenv/config';
import mysql from 'mysql2/promise';

export async function startApp(name, env = {}) {
  const dbName = `signalwrite_test_${name}`;
  if (!/^signalwrite_test_[a-z0-9_]+$/.test(dbName)) throw new Error('unsafe test database name');

  process.env.NODE_ENV = 'test';
  process.env.MYSQL_DATABASE = dbName;
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.ADMIN_EMAILS = 'admin@test.local';
  process.env.TRIAL_DAYS = '14';
  process.env.PLAN_PRICE = '₹999/month';
  process.env.SUBSCRIBE_CONTACT = 'sales@test.local';
  Object.assign(process.env, env);

  // Fresh database (only ever the signalwrite_test_* one).
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '', connectTimeout: 3000
    });
  } catch (error) {
    return { unavailable: `MySQL is not running (${error.code || error.message}); start it to run these tests.` };
  }
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.end();

  const { initializeDatabase, pool } = await import('../server/db.js');
  await initializeDatabase();
  const { app } = await import('../server/index.js');
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, body, { raw, cookie } = {}) {
    const init = { method, headers: {} };
    if (cookie) init.headers.Cookie = cookie;
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = raw ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }

  const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

  // Creates an account and returns { cookie, user }.
  async function signup(email, password = 'test-password-1', name = 'Tester') {
    const res = await call('POST', '/api/signup', { email, password, name });
    if (res.status !== 201) throw new Error(`signup failed ${res.status}: ${res.text}`);
    return { cookie: cookieFrom(res), user: res.json };
  }

  return {
    call, signup, cookieFrom,
    query: (sql, args) => pool.query(sql, args).then(([rows]) => rows),
    close: async () => {
      await new Promise((r) => server.close(r));
      await pool.query(`DROP DATABASE IF EXISTS \`${dbName}\``).catch(() => {});
      await pool.end();
    }
  };
}

// Every error must be a short JSON message: no stack traces, file paths or account ids.
export function assertCleanError(assert, res, status, messagePattern) {
  assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${res.text.slice(0, 160)}`);
  assert.ok(res.json && typeof res.json.error === 'string', 'error must be JSON { error }');
  if (messagePattern) assert.match(res.json.error, messagePattern);
  assert.doesNotMatch(res.text, /node_modules|at \w+ \(|<pre>|org_[A-Za-z0-9]|password_hash|scrypt\$/);
}
