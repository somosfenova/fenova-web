const { env, supabaseHeaders, requireAdmin, cleanText } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }
  if (!requireAdmin(req, res)) return;

  try {
    const id = cleanText(req.body?.id, 80);
    const estado = cleanText(req.body?.estado, 30);
    const notas = cleanText(req.body?.notas, 2000);

    if (!id) return res.status(400).json({ ok: false, error: 'Falta id.' });
    if (!['nueva','contactada','cerrada'].includes(estado)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido.' });
    }

    const { url } = env();
    const r = await fetch(
      `${url}/rest/v1/consultas?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ estado, notas: notas || null }),
      }
    );

    if (!r.ok) {
      const detail = await r.text();
      console.error(detail);
      return res.status(502).json({ ok: false, error: 'No pudimos actualizar la consulta.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
  }
};
