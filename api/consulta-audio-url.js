const { env, supabaseHeaders, requireAdmin } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }
  if (!requireAdmin(req, res)) return;

  try {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'Falta id.' });

    const { url } = env();

    const rowRes = await fetch(
      `${url}/rest/v1/consultas?id=eq.${encodeURIComponent(id)}&select=audio_path,audio_mime_type&limit=1`,
      { headers: supabaseHeaders() }
    );
    const rows = await rowRes.json().catch(() => []);

    if (!rowRes.ok || !rows?.[0]?.audio_path) {
      return res.status(404).json({ ok: false, error: 'Audio no encontrado.' });
    }

    const path = rows[0].audio_path;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');

    const signRes = await fetch(
      `${url}/storage/v1/object/sign/consultas-audio/${encodedPath}`,
      {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: 900 }),
      }
    );

    const signed = await signRes.json().catch(() => ({}));

    if (!signRes.ok) {
      return res.status(502).json({ ok: false, error: 'No pudimos abrir el audio.' });
    }

    let signedUrl = signed.signedURL || signed.signedUrl || '';
    if (signedUrl && !/^https?:\/\//i.test(signedUrl)) {
      if (!signedUrl.startsWith('/')) signedUrl = '/' + signedUrl;
      // createSignedUrl returns /object/sign/... relative to /storage/v1
      signedUrl = `${url}/storage/v1${signedUrl}`;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      url: signedUrl,
      mime: rows[0].audio_mime_type || null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
  }
};
