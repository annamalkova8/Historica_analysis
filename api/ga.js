import { ready } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { syncGa, gaStatus, gaConfigured } from '../_lib/ga.js';
import { syncCw, cwStatus, cwConfigured } from '../_lib/cw.js';

/** GET -> {configured, last, data, cw}.  POST -> pull the Google Analytics reports and the CloudWatch map traffic now. */
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    if (req.method === 'POST') {
      if (!gaConfigured() && !cwConfigured()) return res.status(400).json({ error: 'Google Analytics is not configured: set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON in Vercel → Settings → Environment Variables, then redeploy.' });
      const r = gaConfigured() ? await syncGa('manual') : { count: 0, error: null };
      const w = cwConfigured() ? await syncCw('manual') : null;
      const error = [r.error, w?.error && 'CloudWatch: ' + w.error].filter(Boolean).join(' | ');
      return res.status(error ? 502 : 200).json(error ? { error } : { ok: true, days: r.count, cwDays: w?.count ?? null });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...(await gaStatus()), cw: await cwStatus() });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
