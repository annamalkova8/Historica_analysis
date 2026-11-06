import { ready } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { syncJira, jiraStatus, jiraConfigured } from '../_lib/jira.js';

/** GET -> {configured, last, base}.  POST -> pull issues from Jira now. */
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    if (req.method === 'POST') {
      if (!jiraConfigured()) return res.status(400).json({ error: 'Jira is not configured: set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT in Vercel → Settings → Environment Variables, then redeploy.' });
      const r = await syncJira('manual');
      return res.status(r.error ? 502 : 200).json(r.error ? { error: r.error } : { ok: true, count: r.count });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(await jiraStatus());
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
