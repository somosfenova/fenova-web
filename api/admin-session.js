const { requireAdmin } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  if (!requireAdmin(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
};
