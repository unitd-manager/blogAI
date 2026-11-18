// Team password login.
//
// Set APP_PASSWORD in .env and everyone must enter it once per browser (remembered for 30 days).
// If APP_PASSWORD is empty, login is switched off (handy on your own computer).
//
// The session is a signed cookie: "<expiry>.<signature>". The signing key is derived from
// APP_PASSWORD (or SESSION_SECRET if set), so changing the password logs everyone out.
// The cookie is HttpOnly (page scripts can't read it) and SameSite=Lax (other sites can't use it).
import crypto from 'node:crypto';

const COOKIE = 'sw_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const loginEnabled = () => Boolean(process.env.APP_PASSWORD);

const signingKey = () => crypto.createHash('sha256')
  .update(`signalwrite-session:${process.env.SESSION_SECRET || ''}:${process.env.APP_PASSWORD || ''}`)
  .digest();

const sign = (value) => crypto.createHmac('sha256', signingKey()).update(value).digest('base64url');

// Compare via fixed-length hashes so the time taken never reveals how much of the password matched.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export const passwordMatches = (attempt) => loginEnabled() && typeof attempt === 'string' && safeEqual(attempt, process.env.APP_PASSWORD);

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export function isLoggedIn(req) {
  if (!loginEnabled()) return true;
  const token = readCookie(req, COOKIE);
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expiry = token.slice(0, dot);
  if (!/^\d{10,16}$/.test(expiry) || Number(expiry) < Date.now()) return false;
  return safeEqual(token.slice(dot + 1), sign(expiry));
}

function cookieFlags(req) {
  // Secure on HTTPS (also behind a proxy that says so); plain http://localhost still works for local testing.
  const secure = req.secure ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function setSessionCookie(req, res) {
  const expiry = String(Date.now() + MAX_AGE_MS);
  res.setHeader('Set-Cookie', `${COOKIE}=${expiry}.${sign(expiry)}; Max-Age=${MAX_AGE_MS / 1000}; ${cookieFlags(req)}`);
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
}

// API routes that work without logging in.
const PUBLIC_API = new Set(['/api/health', '/api/session', '/api/login', '/api/logout']);

export function requireLogin(req, res, next) {
  if (!req.path.startsWith('/api/') || PUBLIC_API.has(req.path) || isLoggedIn(req)) return next();
  res.status(401).json({ error: 'Please log in to continue.', loginRequired: true });
}
