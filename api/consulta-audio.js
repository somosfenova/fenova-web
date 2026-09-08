const crypto = require('crypto');
const {
  env,
  supabaseHeaders,
  readRawBody,
  cleanText,
  audioExtension,
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  try {
    const { url } = env();

    const name = cleanText(req.query.name, 120);
    const phone = cleanText(req.query.phone, 80);
    const company = cleanText(req.query.company, 160);
    const email = cleanText(req.query.email, 180);
    const duration = Math.max(1, Math.min(120, Number(req.query.duration) || 1));
    const mime = cleanText(req.headers['x-audio-mime'] || 'audio/mp4', 100);

    if (!name) return res.status(400).json({ ok: false, error: 'Falta el nombre.' });
    if (!phone) return res.status(400).json({ ok: false, error: 'Falta un teléfono de contacto.' });
    if (!mime.startsWith('audio/')) {
      return res.status(400).json({ ok: false, error: 'Formato de audio no válido.' });
    }

    const audio = await readRawBody(req, 4_000_000);
    if (!audio.length) {
      return res.status(400).json({ ok: false, error: 'El audio llegó vacío.' });
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const ext = audioExtension(mime);
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const filePath = `${year}/${month}/${id}.${ext}`;
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');

    // 1) Storage privado
    const storageRes = await fetch(
      `${url}/storage/v1/object/consultas-audio/${encodedPath}`,
      {
        method: 'POST',
        headers: supabaseHeaders({
          'Content-Type': mime,
          'x-upsert': 'false',
          'Cache-Control': '3600',
        }),
        body: audio,
      }
    );

    if (!storageRes.ok) {
      const detail = await storageRes.text();
      console.error('Storage upload error:', detail);
      return res.status(502).json({ ok: false, error: 'No pudimos guardar el audio.' });
    }

    // 2) Registro en tabla
    const row = {
      id,
      tipo: 'audio',
      nombre: name,
      empresa: company || null,
      email: email || null,
      telefono: phone,
      mensaje: null,
      audio_path: filePath,
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

      // Limpieza best-effort del archivo si falla la DB
      await fetch(`${url}/storage/v1/object/consultas-audio/${encodedPath}`, {
        method: 'DELETE',
        headers: supabaseHeaders(),
      }).catch(() => {});

      return res.status(502).json({ ok: false, error: 'No pudimos registrar la consulta.' });
    }

    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno al procesar la consulta.',
    });
  }
};
