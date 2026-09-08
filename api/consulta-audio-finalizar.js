const {
  env,
  supabaseHeaders,
  cleanText,
  verifyUploadSession,
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  try {
    const id = cleanText(req.body?.id, 80);
    const path = cleanText(req.body?.path, 500);
    const uploadSession = cleanText(req.body?.uploadSession, 300);
    const name = cleanText(req.body?.name, 120);
    const phone = cleanText(req.body?.phone, 80);
    const company = cleanText(req.body?.company, 160);
    const email = cleanText(req.body?.email, 180);
    const mime = cleanText(req.body?.mime || 'audio/mp4', 120);
    const duration = Math.max(1, Math.min(120, Number(req.body?.duration) || 1));

    if (!id || !path || !uploadSession) {
      return res.status(400).json({ ok: false, error: 'Faltan datos de la carga.' });
    }
    if (!verifyUploadSession(uploadSession, id, path)) {
      return res.status(401).json({ ok: false, error: 'La carga venció o no es válida.' });
    }
    if (!name) return res.status(400).json({ ok: false, error: 'Falta el nombre.' });
    if (!phone) return res.status(400).json({ ok: false, error: 'Falta un teléfono de contacto.' });

    const { url } = env();
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');

    // Confirmamos que el objeto realmente exista antes de registrar la consulta.
    const infoRes = await fetch(
      `${url}/storage/v1/object/info/consultas-audio/${encodedPath}`,
      { headers: supabaseHeaders() }
    );

    if (!infoRes.ok) {
      const detail = await infoRes.text();
      console.error('Audio info error:', detail);
      return res.status(409).json({
        ok: false,
        error: 'El archivo de audio todavía no está disponible.',
      });
    }

    const row = {
      id,
      tipo: 'audio',
      nombre: name,
      empresa: company || null,
      email: email || null,
      telefono: phone,
      mensaje: null,
      audio_path: path,
      audio_mime_type: mime,
      duracion_segundos: Math.round(duration),
      estado: 'nueva',
      notas: null,
    };

    const dbRes = await fetch(`${url}/rest/v1/consultas`, {
      method: 'POST',
      headers: supabaseHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(row),
    });

    if (!dbRes.ok) {
      const detail = await dbRes.text();
      console.error('DB insert error:', detail);

      await fetch(`${url}/storage/v1/object/consultas-audio/${encodedPath}`, {
        method: 'DELETE',
        headers: supabaseHeaders(),
      }).catch(() => {});

      return res.status(502).json({
        ok: false,
        error: 'No pudimos registrar la consulta.',
      });
    }

    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno.',
    });
  }
};
