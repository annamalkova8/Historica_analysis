import { requireAuth } from '../_lib/auth.js';

// Reads one Confluence page (rendered HTML) with the same Atlassian credentials as the Jira sync:
// JIRA_BASE_URL (site), JIRA_EMAIL, JIRA_API_TOKEN. The page id comes from ?page= (id or full page URL),
// BETA_TESTERS_PAGE, or the default below. The browser parses the table and imports only anonymous fields.
const DEFAULT_PAGE = '73695233'; // https://historica.atlassian.net/wiki/spaces/Historica/pages/73695233/Beta+testers
const site = () => { const r = String(process.env.JIRA_BASE_URL || '').trim().replace(/^(?!https?:\/\/)/i, 'https://'); try { return new URL(r).origin; } catch { return ''; } };
const pageId = (v) => (String(v || '').match(/pages\/(\d+)/) || String(v || '').match(/^(\d+)$/) || [])[1] || '';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    const id = pageId(req.query?.page) || pageId(process.env.BETA_TESTERS_PAGE) || DEFAULT_PAGE;
    if (!site() || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) return res.status(400).json({ error: 'Atlassian is not configured: set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN (the same as for the Jira sync).' });
    const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
    const r = await fetch(`${site()}/wiki/rest/api/content/${id}?expand=body.view,version`, { headers: { authorization: auth, accept: 'application/json' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const why = { 401: 'email or API token is wrong', 403: 'this account cannot view the page', 404: 'page not found (check the page id / that the account has Confluence access)' }[r.status] || '';
      return res.status(502).json({ error: `Confluence ${r.status}${why ? ' (' + why + ')' : ''}: ${j.message || r.statusText}` });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ title: j.title, version: j.version?.number, when: j.version?.when, html: j.body?.view?.value || '' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
