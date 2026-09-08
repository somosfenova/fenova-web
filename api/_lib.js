const crypto = require('crypto');

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase no está configurado en Vercel.');
  return { url: url.replace(/\/+$/, ''), key };
}

function supabaseHeaders(extra = {}) {
  const { key } = env();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const cookies = {};
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function authSecret() {
  const secret = process.env.ADMIN_CONSULTAS_PASSWORD || '';
  if (!secret) throw new Error('ADMIN_CONSULTAS_PASSWORD no está configurada.');
  return secret;
}

function signSession(exp) {
  const payload = String(exp);
  const signature = crypto
    .createHmac('sha256', authSecret())
    .update(`fenova-admin:${payload}`)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(token) {
  const [expRaw, signature] = String(token || '').split('.');
  const exp = Number(expRaw);
  if (!exp || !signature || Date.now() > exp) return false;
  const expected = signSession(exp);
  return safeEqual(expected, token);
}

function makeSessionCookie() {
  const exp = Date.now() + (12 * 60 * 60 * 1000); // 12 horas
  const token = signSession(exp);
  return `fenova_admin=${encodeURIComponent(token)}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return 'fenova_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
}

function requireAdmin(req, res) {
  try {
    const cookies = parseCookies(req);
    if (verifySession(cookies.fenova_admin)) return true;

    // Compatibilidad temporal con el panel V10.5.
    const expected = process.env.ADMIN_CONSULTAS_PASSWORD || '';
    const received = req.headers['x-admin-password'] || '';
    if (expected && received && safeEqual(received, expected)) return true;
  } catch {}

  res.status(401).json({ ok: false, error: 'Sesión vencida o no autorizada.' });
  return false;
}

async function readRawBody(req, maxBytes = 4_000_000) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) throw new Error('El audio supera el tamaño permitido.');
    return req.body;
  }
  if (typeof req.body === 'string') {
    const b = Buffer.from(req.body);
    if (b.length > maxBytes) throw new Error('El audio supera el tamaño permitido.');
    return b;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) throw new Error('El audio supera el tamaño permitido.');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function audioExtension(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

module.exports = {
  env,
  supabaseHeaders,
  cleanText,
  safeEqual,
  parseCookies,
  authSecret,
  makeSessionCookie,
  clearSessionCookie,
  requireAdmin,
  readRawBody,
  audioExtension,
};
