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
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) cookies[k] = decodeURIComponent(v);
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
  const exp = Date.now() + (12 * 60 * 60 * 1000);
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
  } catch {}

  res.status(401).json({ ok: false, error: 'Sesión vencida o no autorizada.' });
  return false;
}

function audioExtension(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

function makeUploadSession(id, path) {
  const { key } = env();
  const exp = Date.now() + (2 * 60 * 60 * 1000);
  const body = `${exp}|${id}|${path}`;
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${exp}.${sig}`;
}

function verifyUploadSession(token, id, path) {
  const [expRaw, sig] = String(token || '').split('.');
  const exp = Number(expRaw);
  if (!exp || !sig || Date.now() > exp) return false;
  const { key } = env();
  const body = `${exp}|${id}|${path}`;
  const expected = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return safeEqual(sig, expected);
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
  audioExtension,
  makeUploadSession,
  verifyUploadSession,
};
