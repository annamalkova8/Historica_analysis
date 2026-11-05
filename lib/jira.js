// Jira Cloud sync (read-only). Pulls issues with the REST API and stores them as records of kind "jira"
// (id "jira_<KEY>"). The UI computes project progress and team performance from these rows.
//
// Env: JIRA_BASE_URL (https://yourteam.atlassian.net), JIRA_EMAIL, JIRA_API_TOKEN (id.atlassian.com -> Security -> API tokens),
//      JIRA_JQL (optional, default: project = $JIRA_PROJECT ... ), JIRA_PROJECT (key, used by the default JQL),
//      JIRA_STORY_POINTS_FIELD (optional, default customfield_10016).
import { q, getSetting, setSetting } from './db.js';

let override = null;
export function setJira(fn) { override = fn; } // tests / local preview: async () => rawIssues[]

// Forgiving config: JIRA_BASE_URL may be any Jira page URL (e.g. a board link) - only the site origin is used;
// the project key is taken from JIRA_PROJECT or, if empty, from a ".../projects/KEY/..." base URL.
const rawBase = () => String(process.env.JIRA_BASE_URL || '').trim().replace(/^(?!https?:\/\/)/i, 'https://');
const base = () => { const r = rawBase(); if (r === 'https://') return ''; try { return new URL(r).origin; } catch { return r.replace(/\/+$/, ''); } };
const projectRef = () => {
  const p = String(process.env.JIRA_PROJECT || '').trim();
  return p || (rawBase().match(/\/projects\/([A-Za-z][A-Za-z0-9_]*)/) || [])[1] || '';
};
export const jiraConfigured = () =>
  !!(override || (base() && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN && (process.env.JIRA_JQL || projectRef())));
const pointsField = () => process.env.JIRA_STORY_POINTS_FIELD || 'customfield_10016';
export const jql = () => {
  if (process.env.JIRA_JQL) return process.env.JIRA_JQL;
  const p = projectRef();   // a project KEY (DEV) or a project NAME ("Historica tech"); both work in JQL when quoted
  return `project = "${p.replace(/"/g, '')}" ORDER BY updated DESC`;
};

async function fetchRaw() {
  if (override) return override();
  const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const fields = ['summary', 'status', 'assignee', 'issuetype', 'priority', 'labels', 'created', 'updated', 'resolutiondate', 'duedate', 'parent', pointsField()];
  const out = [];
  let token = null;
  for (let page = 0; page < 40; page++) { // up to 40 x 100 issues
    const body = { jql: jql(), maxResults: 100, fields };
    if (token) body.nextPageToken = token;
    const r = await fetch(`${base()}/rest/api/3/search/jql`, {
      method: 'POST', headers: { authorization: auth, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const why = { 401: 'email or API token is wrong or was revoked', 403: 'this account has no permission for the project', 404: 'site URL or project not found (JIRA_BASE_URL must be the site, e.g. https://yourteam.atlassian.net)', 410: 'Jira endpoint removed - the app needs updating' }[r.status] || '';
      throw new Error(`Jira ${r.status}${why ? ' (' + why + ')' : ''}: ${(j.errorMessages || []).join('; ') || (j.errors && Object.values(j.errors).join('; ')) || j.message || r.statusText}`);
    }
    out.push(...(j.issues || []));
    if (j.isLast || !j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return out;
}

export function toRecord(i) {
  const f = i.fields || {};
  const day = (v) => (v ? String(v).slice(0, 10) : '');
  return {
    key: i.key, summary: f.summary || '', status: f.status?.name || '', cat: f.status?.statusCategory?.key || 'new',
    type: f.issuetype?.name || '', assignee: f.assignee?.displayName || 'Unassigned', priority: f.priority?.name || '',
    labels: f.labels || [], created: day(f.created), updated: day(f.updated), resolved: day(f.resolutiondate), due: day(f.duedate),
    epic: f.parent?.key || '', epicName: f.parent?.fields?.summary || '',
    points: Number(f[pointsField()]) || 0,
    url: base() ? `${base()}/browse/${i.key}` : '',
  };
}

/** Full re-sync: upsert every issue returned by the JQL, delete rows no longer returned. */
export async function syncJira(trigger = 'manual') {
  if (!jiraConfigured()) throw new Error('Jira is not configured (set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT or JIRA_JQL in Vercel)');
  const run = (await q('INSERT INTO runs (service, task, trigger) VALUES ($1,$2,$3) RETURNING id', ['jira', 'Sync issues', trigger]))[0];
  let count = 0, error = null;
  try {
    const rows = (await fetchRaw()).map(toRecord).filter((r) => r.key);
    count = rows.length;
    if (rows.length) {
      await q(
        `INSERT INTO records (id, kind, key, data)
         SELECT id, 'jira', id2, data::jsonb FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, id2, data)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, key = EXCLUDED.key, updated_at = now()`,
        [rows.map((r) => 'jira_' + r.key), rows.map((r) => r.key), rows.map((r) => JSON.stringify(r))],
      );
    }
    await q(`DELETE FROM records WHERE kind='jira' AND NOT (id = ANY($1::text[]))`, [rows.map((r) => 'jira_' + r.key)]);
    await setSetting('jira:last', { at: new Date().toISOString(), count });
  } catch (e) {
    error = String(e?.message || e).slice(0, 500);
  }
  await q('UPDATE runs SET finished_at=now(), found=$2, added=$2, error=$3 WHERE id=$1', [run.id, count, error]);
  return { count, error };
}

export async function jiraStatus() {
  return { configured: jiraConfigured(), last: await getSetting('jira:last', null), base: base() };
}
