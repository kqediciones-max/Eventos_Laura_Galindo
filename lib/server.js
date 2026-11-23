import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

const SESSION_COOKIE = 'lg_admin_session';
const SESSION_SECONDS = 60 * 60 * 8;
const attempts = new Map();
const submissions = new Map();

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export function verifySameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const requestHost = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origin).host.toLowerCase() === String(requestHost || '').toLowerCase();
  } catch {
    return false;
  }
}

export function adminAccount(username) {
  const users = {
    pedroq: { name: 'Pedro Quecan', password: process.env.ADMIN_PEDRO_PASSWORD },
    karenq: { name: 'Karen Quintero', password: process.env.ADMIN_KAREN_PASSWORD }
  };
  return users[username] || null;
}

function hmac(value) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET no está configurado correctamente');
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safePasswordEqual(provided, expected) {
  if (!expected) return false;
  const left = createHash('sha256').update(String(provided)).digest();
  const right = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(left, right);
}

export function sessionCookie(username, name, req) {
  const payload = Buffer.from(JSON.stringify({
    username,
    name,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  const secure = process.env.NODE_ENV === 'production' || req?.headers?.['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${payload}.${hmac(payload)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie(req) {
  const secure = process.env.NODE_ENV === 'production' || req?.headers?.['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`;
}

export function currentAdmin(req) {
  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  try {
    const expected = hmac(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const account = adminAccount(session.username);
    if (!account || session.name !== account.name || session.exp < Math.floor(Date.now() / 1000)) return null;
    return { username: session.username, name: session.name };
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const user = currentAdmin(req);
  if (!user) {
    sendJson(res, 401, { error: 'Inicia sesión para continuar.' });
    return null;
  }
  return user;
}

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

export function rateLimited(req, bucket, max, windowMs) {
  const key = `${bucket}:${clientKey(req)}`;
  const now = Date.now();
  const record = bucket === 'login' ? attempts : submissions;
  const current = record.get(key);
  if (!current || current.until < now) {
    record.set(key, { count: 1, until: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > max;
}

export async function supabaseRequest(tablePath, method = 'GET', body = undefined, query = '') {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw new Error('Configura SUPABASE_URL y SUPABASE_SECRET_KEY en Vercel.');
  const response = await fetch(`${base}/rest/v1/${tablePath}${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}: ${text.slice(0, 240)}`);
  return text ? JSON.parse(text) : null;
}

export function safeText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function publicRateLimited(req) {
  return rateLimited(req, 'submit', 5, 60_000);
}

export function loginRateLimited(req) {
  return rateLimited(req, 'login', 7, 15 * 60_000);
}
