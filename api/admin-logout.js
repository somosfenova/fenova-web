const { clearSessionCookie } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
};
