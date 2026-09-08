const crypto = require('crypto');
const {
  env,
  supabaseHeaders,
  cleanText,
  audioExtension,
  makeUploadSession,
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  try {
    const mime = cleanText(req.body?.mime || 'audio/mp4', 120);
    const duration = Math.max(1, Math.min(120, Number(req.body?.duration) || 1));

    if (!mime.startsWith('audio/')) {
      return res.status(400).json({ ok: false, error: 'Formato de audio no válido.' });
    }

    const { url } = env();
    const id = crypto.randomUUID();
    const ext = audioExtension(mime);
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const path = `${year}/${month}/${id}.${ext}`;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');

    const signedRes = await fetch(
      `${url}/storage/v1/object/upload/sign/consultas-audio/${encodedPath}`,
      {
        method: 'POST',
        headers: supabaseHeaders({
          'Content-Type': 'application/json',
          'x-upsert': 'false',
        }),
        body: '{}',
      }
    );

    const signedData = await signedRes.json().catch(() => ({}));

    if (!signedRes.ok) {
      console.error('Signed upload error:', signedData);
      return res.status(502).json({
        ok: false,
        error: 'No pudimos preparar la carga segura del audio.',
      });
    }

    let signedUrl =
      signedData.url ||
      signedData.signedUrl ||
      signedData.signedURL ||
      '';

    if (!signedUrl) {
      return res.status(502).json({
        ok: false,
        error: 'Supabase no devolvió una URL de carga.',
      });
    }

    if (!/^https?:\/\//i.test(signedUrl)) {
      if (!signedUrl.startsWith('/')) signedUrl = '/' + signedUrl;
      signedUrl = `${url}/storage/v1${signedUrl}`;
    }

    const uploadSession = makeUploadSession(id, path);

    return res.status(200).json({
      ok: true,
      id,
      path,
      signedUrl,
      uploadSession,
      duration,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Error interno.',
    });
  }
};
