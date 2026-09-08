const { authSecret, safeEqual, makeSessionCookie } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  try {
    const received = String(req.body?.password || '');
    if (!received || !safeEqual(received, authSecret())) {
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
    }

    res.setHeader('Set-Cookie', makeSessionCookie());
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
  }
};
