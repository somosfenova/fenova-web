const { env, supabaseHeaders, requireAdmin } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }
  if (!requireAdmin(req, res)) return;

  try {
    const { url } = env();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const endpoint =
      `${url}/rest/v1/consultas?select=id,created_at,tipo,nombre,empresa,email,telefono,mensaje,audio_path,audio_mime_type,duracion_segundos,estado,notas` +
      `&order=created_at.desc&limit=${limit}`;

    const r = await fetch(endpoint, { headers: supabaseHeaders() });
    const text = await r.text();

    if (!r.ok) {
      console.error(text);
      return res.status(502).json({ ok: false, error: 'No pudimos leer las consultas.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, consultas: JSON.parse(text || '[]') });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
  }
};
