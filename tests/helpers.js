// Starts the Express app on a random free port, without MySQL or the AI service.
// Only routes that fail validation before touching the database or AI are tested here,
// so the tests are fast, free, and safe to run anywhere.
export async function startApp(env = {}) {
  process.env.NODE_ENV = 'test';
  // Point the database at a closed port so tests can never touch real data:
  // any route that reaches the database answers 503 instead.
  process.env.MYSQL_HOST = '127.0.0.1';
  process.env.MYSQL_PORT = '1';
  Object.assign(process.env, env);
  const { app } = await import('../server/index.js');
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, body, { raw } = {}) {
    const init = { method, headers: {} };
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

  return { call, close: () => new Promise((r) => server.close(r)) };
}
