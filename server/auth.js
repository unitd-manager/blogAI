// Customer accounts, sessions, free trial and admin access.
//
//  - Anyone can sign up with email + password. A free trial (TRIAL_DAYS, default 14) starts at signup.
//  - After the trial the account is read-only (view / copy / download / delete), until an admin
//    activates a subscription for it (payment is handled outside the app for now).
//  - Emails listed in ADMIN_EMAILS are the owner's team: always full access, never asked to subscribe,
//    and they see the Admin page.
//
// Passwords are stored as scrypt hashes. The session is a signed HttpOnly cookie
// "<userId>.<sessionVersion>.<expiry>.<signature>". Bumping a user's session_version
// (password reset) logs that user out everywhere.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'sw_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const trialDays = () => {
  const n = Number(process.env.TRIAL_DAYS);
  return Number.isInteger(n) && n > 0 && n <= 365 ? n : 14;
};

export const adminEmails = () => new Set(String(process.env.ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));

export const isAdminEmail = (email) => adminEmails().has(String(email || '').toLowerCase());

// ---- Passwords ----
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, saltB64, hashB64] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Used when the email doesn't exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
export const burnPasswordCheck = (password) => verifyPassword(password, DUMMY_HASH).catch(() => false);

export function makeTempPassword() {
  return crypto.randomBytes(9).toString('base64url'); // 12 characters
}

// ---- Session secret: SESSION_SECRET from .env, otherwise generated once and kept in the database ----
let cachedSecret = null;
async function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  const [rows] = await pool.query("SELECT value FROM settings WHERE name = '__session_secret'");
  if (rows[0]?.value) return (cachedSecret = rows[0].value);
  const fresh = crypto.randomBytes(32).toString('base64url');
  await pool.query("INSERT IGNORE INTO settings (name, value) VALUES ('__session_secret', ?)", [fresh]);
  const [again] = await pool.query("SELECT value FROM settings WHERE name = '__session_secret'");
  return (cachedSecret = again[0].value);
}

const sign = async (payload) => crypto.createHmac('sha256', await sessionSecret()).update(payload).digest('base64url');

function safeEqualText(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return ''; }
    }
  }
  return '';
}

const cookieFlags = (req) => `Path=/; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`;

export async function setSessionCookie(req, res, user) {
  const payload = `${user.id}.${user.session_version}.${Date.now() + MAX_AGE_MS}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${payload}.${await sign(payload)}; Max-Age=${MAX_AGE_MS / 1000}; ${cookieFlags(req)}`);
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
}

// ---- Account status ----
export function accountStatus(user, now = Date.now()) {
  if (isAdminEmail(user.email)) return 'admin';
  if (user.disabled) return 'disabled';
  if (user.subscription_until && new Date(user.subscription_until).getTime() > now) return 'active';
  if (new Date(user.trial_ends_at).getTime() > now) return 'trial';
  return 'expired';
}

export const canWrite = (user) => ['admin', 'active', 'trial'].includes(accountStatus(user));

export function publicProfile(user) {
  const status = accountStatus(user);
  // Whole days left, rounded up. A few minutes of slack so a fresh 14-day trial shows 14, not 15
  // (MySQL rounds the stored time to the nearest second); never 0 while time remains.
  const daysLeft = (date) => {
    const ms = date ? new Date(date).getTime() - Date.now() : 0;
    return ms <= 0 ? 0 : Math.max(1, Math.ceil((ms - 5 * 60 * 1000) / DAY_MS));
  };
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    isAdmin: status === 'admin',
    status,
    canWrite: canWrite(user),
    trialEndsAt: user.trial_ends_at,
    trialDaysLeft: status === 'trial' ? daysLeft(user.trial_ends_at) : 0,
    subscriptionUntil: user.subscription_until || null,
    subscriptionDaysLeft: status === 'active' ? daysLeft(user.subscription_until) : 0,
    plan: {
      price: process.env.PLAN_PRICE || '₹999/month',
      contact: process.env.SUBSCRIBE_CONTACT || '',
      trialDays: trialDays()
    }
  };
}

// ---- Middleware ----
// Reads the session cookie and loads the user into req.user (or leaves it undefined).
export async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  const parts = token.split('.');
  if (parts.length !== 4 || !/^\d{1,10}$/.test(parts[0]) || !/^\d{1,9}$/.test(parts[1]) || !/^\d{10,16}$/.test(parts[2])) return next();
  if (Number(parts[2]) < Date.now()) return next();
  try {
    if (!safeEqualText(parts[3], await sign(parts.slice(0, 3).join('.')))) return next();
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [parts[0]]);
    const user = rows[0];
    if (user && String(user.session_version) === parts[1] && (!user.disabled || isAdminEmail(user.email))) req.user = user;
    next();
  } catch (error) {
    console.warn('[auth] could not check session:', error.message);
    res.status(503).json({ error: 'The server cannot reach its database right now. Please try again shortly.' });
  }
}

// API routes that work without logging in.
const PUBLIC_API = new Set(['/api/health', '/api/signup', '/api/login', '/api/logout']);

export function requireUser(req, res, next) {
  if (!req.path.startsWith('/api/') || PUBLIC_API.has(req.path) || req.user) return next();
  res.status(401).json({ error: 'Please log in to continue.', loginRequired: true });
}

// Writing (AI, edits, settings) needs an active trial or subscription. Admins always pass.
export function requireActive(req, res, next) {
  if (canWrite(req.user)) return next();
  const status = accountStatus(req.user);
  const contact = process.env.SUBSCRIBE_CONTACT ? ` Contact ${process.env.SUBSCRIBE_CONTACT} to subscribe.` : ' Contact us to subscribe.';
  const message = status === 'disabled'
    ? 'This account is disabled. Please contact support.'
    : `Your free trial has ended. Your articles are still here to view, copy and download.${contact}`;
  res.status(402).json({ error: message, subscriptionRequired: true });
}

export function requireAdmin(req, res, next) {
  if (req.user && isAdminEmail(req.user.email)) return next();
  res.status(403).json({ error: 'Only admins can do this.' });
}
