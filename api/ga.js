import { ready } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { syncGa, gaStatus, gaConfigured } from '../_lib/ga.js';

/** GET -> {configured, last, data}.  POST -> pull the Google Analytics reports now. */
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    if (req.method === 'POST') {
      if (!gaConfigured()) return res.status(400).json({ error: 'Google Analytics is not configured: set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON in Vercel → Settings → Environment Variables, then redeploy.' });
      const r = await syncGa('manual');
      return res.status(r.error ? 502 : 200).json(r.error ? { error: r.error } : { ok: true, days: r.count });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(await gaStatus());
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
