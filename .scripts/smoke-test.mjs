// Local smoke test: in-memory Postgres (PGlite) + mocked OpenAI. No network, no keys needed.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
process.env.APP_PASSWORD = 'pw'; process.env.CRON_SECRET = 'cs';

const { setDb, ready, q } = await import('../_lib/db.js');
const { setLlm } = await import('../_lib/llm.js');
const pg = new PGlite();
setDb({ query: async (text, params) => (await pg.query(text, params)).rows });

const call = async (mod, { method = 'GET', body, headers = {}, query = {} } = {}) => {
  const h = (await import(`../api/${mod}.js`)).default;
  const out = { code: 200, headers: {} };
  const res = { status(c) { out.code = c; return res; }, json(j) { out.json = j; return out; }, setHeader(k, v) { out.headers[k] = v; } };
  await h({ method, body, headers, query }, res);
  return out;
};

// auth
assert.equal((await call('state')).code, 401);
assert.equal((await call('login', { method: 'POST', body: { password: 'bad' } })).code, 401);
const login = await call('login', { method: 'POST', body: { password: 'pw' } });
assert.equal(login.code, 200);
const cookie = login.headers['Set-Cookie'].split(';')[0];
const auth = { cookie };

// empty state + sync
await ready();
let st = await call('state', { headers: auth });
assert.equal(st.json.seeded, false);
const sync = await call('sync', { method: 'POST', headers: auth, body: {
  upserts: [{ kind: 'comms', id: 'c_1', data: { _id: 'c_1', name: 'r/Maps', url: 'https://www.reddit.com/r/Maps/', status: 'Not started' } },
            { kind: 'grants', id: 'c_2', data: { name: 'NLnet', link: 'https://nlnet.nl/', applied: 'Yes' } }],
  markSeeded: true } });
assert.equal(sync.json.upserts, 2);
st = await call('state', { headers: auth });
assert.equal(st.json.seeded, true);
assert.equal(st.json.data.comms[0]._id, 'c_1');

// update + delete
await call('sync', { method: 'POST', headers: auth, body: { upserts: [{ kind: 'grants', id: 'c_2', data: { name: 'NLnet', link: 'https://nlnet.nl/', applied: 'No' } }], deletes: [{ kind: 'comms', id: 'c_1' }] } });
st = await call('state', { headers: auth });
assert.equal(st.json.data.grants[0].applied, 'No');
assert.equal(st.json.data.comms.length, 0);

// services listing
const sv = await call('services', { headers: auth });
assert.equal(sv.json.services.length, 4);
assert.ok(sv.json.services.find((s) => s.id === 'grants').tasks.length >= 20);

// pipeline with mocked LLM
let prompts = [];
setLlm(async (p) => { prompts.push(p); return '```json\n' + JSON.stringify([
  { name: 'Fake Open Call', link: 'https://example.org/call', deadline: '2027-01-31', sum: 'EUR 50,000', period: '12 months', open_source_required: 'yes', scientific_articles_required: 'no', consortium_required: 'no', documents_required: ['proposal', 'budget'], relevance_note: 'fits' },
  { name: 'Consortium Only Call', link: 'https://example.org/c', consortium_required: 'yes' },
  { name: 'Fashion Fund', link: 'https://example.org/f', consortium_required: 'no', relevance_note: 'fashion tech' },
]) + '\n```'; });
let r = await call('run', { method: 'POST', headers: auth, body: { service: 'grants', task: 0 } });
assert.equal(r.json.added, 1, JSON.stringify(r.json));
r = await call('run', { method: 'POST', headers: auth, body: { service: 'grants', task: 1 } });
assert.equal(r.json.added, 0, 'second run must not duplicate');
st = await call('state', { headers: auth });
const g = st.json.data.grants.find((x) => x.name === 'Fake Open Call');
assert.ok(g && g.isNew && g.oss === 'Yes' && g.docs === 'proposal, budget' && g.applied === 'No');

setLlm(async () => JSON.stringify([{ name: 'DH 2027', link: 'https://dh.org', start_date: '2027-07-05', location: 'Berlin, Germany', cfp_deadline: '2026-12-01', cost: 'EUR 350', topics: 'DH', relevance_note: 'x' },
  { name: 'Old Conf 2020', link: 'https://o', start_date: '2020-01-01' }]));
r = await call('run', { method: 'POST', headers: auth, body: { service: 'conferences', task: 0 } });
assert.equal(r.json.added, 1, JSON.stringify(r.json));
st = await call('state', { headers: auth });
assert.equal(st.json.data.confs[0].cost, 350);

setLlm(async () => JSON.stringify([{ name: 'r/historyteachers', url: 'https://www.reddit.com/r/historyteachers/?utm=1', platform: 'Reddit', priority: 'Very high', goal: 'Feedback' }]));
r = await call('run', { method: 'POST', headers: auth, body: { service: 'communities', task: 0 } });
assert.equal(r.json.added, 1);
r = await call('run', { method: 'POST', headers: auth, body: { service: 'communities', task: 2 } });
assert.equal(r.json.added, 0, 'same url (normalised) is a duplicate');

// error is logged, not thrown
setLlm(async () => { throw new Error('boom'); });
r = await call('run', { method: 'POST', headers: auth, body: { service: 'grants', task: 3 } });
assert.match(r.json.error, /boom/);

// rivals: first run adds, second run REFRESHES (no duplicate), user's other edits survive
setLlm(async () => JSON.stringify([{ name: 'Geacron', link: 'https://geacron.com', market: 'Education', what_new: 'New app 2026', what_we_can_take: 'Export', historica_better: 'monthly steps', historica_worse: 'mobile' },
  { name: 'No Link Product', link: 'not-a-url' }]));
r = await call('run', { method: 'POST', headers: auth, body: { service: 'rivals', task: 0 } });
assert.equal(r.json.added, 1, JSON.stringify(r.json));
st = await call('state', { headers: auth });
const rid = st.json.data.rivals[0]._id;
await call('sync', { method: 'POST', headers: auth, body: { upserts: [{ kind: 'rivals', id: rid, data: { ...st.json.data.rivals[0], take: 'MY EDIT' } }] } });
setLlm(async () => JSON.stringify([{ name: 'GEACRON', link: 'https://geacron.com', what_new: 'Android app rebuilt' }]));
r = await call('run', { method: 'POST', headers: auth, body: { service: 'rivals', task: 0 } });
assert.equal(r.json.added, 0); assert.equal(r.json.updated, 1);
st = await call('state', { headers: auth });
assert.equal(st.json.data.rivals.length, 1);
assert.equal(st.json.data.rivals[0].whatNew, 'Android app rebuilt');
assert.equal(st.json.data.rivals[0].take, 'MY EDIT');

// seeded kinds + jira rows are read-only for the browser
await call('sync', { method: 'POST', headers: auth, body: { upserts: [{ kind: 'jira', id: 'x', data: { key: 'X-1' } }], markSeededKinds: ['rivals', 'bogus'] } });
st = await call('state', { headers: auth });
assert.deepEqual(st.json.seededKinds, ['rivals']);
assert.equal(st.json.data.jira.length, 0, 'browser must not write jira rows');

// Jira sync (mock): upsert, update, delete stale
const { setJira } = await import('../_lib/jira.js');
const issue = (key, extra = {}) => ({ key, fields: { summary: 'S ' + key, status: { name: 'Done', statusCategory: { key: 'done' } }, assignee: { displayName: 'Ann' }, issuetype: { name: 'Task' }, created: '2026-10-01T10:00:00.000+0000', resolutiondate: '2026-10-05T10:00:00.000+0000', labels: ['maps'], parent: { key: 'H-1', fields: { summary: 'Epic one' } }, customfield_10016: 3, ...extra } });
assert.equal((await call('jira', { headers: auth })).json.configured, false);
assert.equal((await call('jira', { method: 'POST', headers: auth })).code, 400);
setJira(async () => [issue('H-2'), issue('H-3', { assignee: null })]);
let jr = await call('jira', { method: 'POST', headers: auth });
assert.equal(jr.json.count, 2, JSON.stringify(jr.json));
st = await call('state', { headers: auth });
const j2 = st.json.data.jira.find((x) => x.key === 'H-2');
assert.ok(j2.cat === 'done' && j2.assignee === 'Ann' && j2.epic === 'H-1' && j2.epicName === 'Epic one' && j2.points === 3 && j2.resolved === '2026-10-05');
assert.equal(st.json.data.jira.find((x) => x.key === 'H-3').assignee, 'Unassigned');
setJira(async () => [issue('H-2')]);
await call('jira', { method: 'POST', headers: auth });
st = await call('state', { headers: auth });
assert.deepEqual(st.json.data.jira.map((x) => x.key), ['H-2']);
assert.equal((await call('jira', { headers: auth })).json.last.count, 1);
setJira(null);

// Jira config tolerance: board URL as base, project name or key, helpful errors (mocked fetch, no network)
const J = await import('../_lib/jira.js');
Object.assign(process.env, { JIRA_BASE_URL: 'https://historica.atlassian.net/jira/software/projects/DEV/boards/2?filter=&groupBy=assignee', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 'tok', JIRA_PROJECT: 'Historica tech' });
assert.equal(J.jiraConfigured(), true);
assert.equal(J.jql(), 'project = "Historica tech" ORDER BY updated DESC');
delete process.env.JIRA_PROJECT;
assert.equal(J.jql(), 'project = "DEV" ORDER BY updated DESC', 'key is taken from the board URL');
const realFetch = globalThis.fetch; let seen = null;
globalThis.fetch = async (url, o) => { seen = { url, body: JSON.parse(o.body), auth: o.headers.authorization }; return { ok: true, status: 200, json: async () => ({ issues: [issue('H-9')], isLast: true }) }; };
jr = await call('jira', { method: 'POST', headers: auth });
assert.equal(jr.json.count, 1, JSON.stringify(jr.json));
assert.equal(seen.url, 'https://historica.atlassian.net/rest/api/3/search/jql');
assert.equal(seen.body.jql, 'project = "DEV" ORDER BY updated DESC');
assert.equal(seen.auth, 'Basic ' + Buffer.from('a@b.c:tok').toString('base64'));
globalThis.fetch = async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) });
jr = await call('jira', { method: 'POST', headers: auth });
assert.equal(jr.code, 502); assert.match(jr.json.error, /401.*revoked/);
globalThis.fetch = realFetch;
for (const k of ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN']) delete process.env[k];

// fuzzy duplicates + "never show again"
const put = (id, data) => call('sync', { method: 'POST', headers: auth, body: { upserts: [{ kind: 'grants', id, data }] } });
await put('d1', { name: 'AWS Activate Credits (Founders / Portfolio tiers)', link: 'https://aws.amazon.com/startups/credits/', applied: 'Yes', result: 'Pending', deadline: 'unknown' });
await put('d2', { name: 'AWS Activate', link: 'https://aws.amazon.com/activate/', applied: 'No', result: '—', deadline: '2027-01-01' });
await put('d3', { name: 'Totally Different Fund', link: 'https://example.org/x', applied: 'No', result: '—' });
await put('d4', { name: 'Wikimedia Rapid Fund', link: 'https://meta.wikimedia.org/wiki/Grants:Project/Rapid', applied: 'No', result: '—', hidden: true });
let dd = await call('dedupe', { method: 'POST', headers: auth, body: { kind: 'grants' } });
assert.equal(dd.json.groups.length, 1, JSON.stringify(dd.json)); assert.equal(dd.json.groups[0].keep, 'AWS Activate Credits (Founders / Portfolio tiers)');
st = await call('state', { headers: auth });
assert.ok(!st.json.data.grants.find((x) => x._id === 'd2').hidden, 'preview must not change data');
dd = await call('dedupe', { method: 'POST', headers: auth, body: { kind: 'grants', apply: true } });
assert.equal(dd.json.hidden, 1);
st = await call('state', { headers: auth });
const d1 = st.json.data.grants.find((x) => x._id === 'd1'), d2 = st.json.data.grants.find((x) => x._id === 'd2');
assert.ok(d2.hidden && d2.dupOf.startsWith('AWS Activate Credits'));
assert.equal(d1.deadline, '2027-01-01', 'kept row gets unknown fields filled from the copy'); assert.ok(!d1.hidden);
assert.equal((await call('dedupe', { method: 'POST', headers: auth, body: { kind: 'grants' } })).json.groups.length, 0, 'idempotent');
assert.equal((await call('dedupe', { method: 'POST', headers: auth, body: { kind: 'nope' } })).code, 400);
// the search must not re-add near-duplicates of visible OR hidden rows
setLlm(async () => JSON.stringify([
  { name: 'AWS Activate Credits', link: 'https://aws.amazon.com/startups/credits/', consortium_required: 'no' },
  { name: 'Wikimedia Rapid Fund 2026', link: 'https://meta.wikimedia.org/wiki/Special:MyLanguage/Grants:Project/Rapid', consortium_required: 'no' },
  { name: 'Brand New Fund', link: 'https://example.org/brand-new', consortium_required: 'no' }]));
r = await call('run', { method: 'POST', headers: auth, body: { service: 'grants', task: 5 } });
assert.equal(r.json.added, 1, JSON.stringify(r.json)); assert.equal(r.json.dups, 2);

// old bot history import: automatic, idempotent, statuses carried over, fuzzy-merged with existing rows
let sn = await call('seen', { method: 'POST', headers: auth });
assert.equal(sn.json.total, 40);
assert.ok(sn.json.added >= 25 && sn.json.added < 40, 'bot duplicates are merged, not all inserted: ' + JSON.stringify(sn.json));
const again = await call('seen', { method: 'POST', headers: auth });
assert.equal(again.json.added, 0); assert.equal(again.json.updated, 0);
st = await call('state', { headers: auth });
assert.ok(st.json.data.grants.some((x) => x.found === 'bot' && x.applied === 'Yes'));
assert.ok(st.json.data.grants.some((x) => x.found === 'bot' && x.hidden));
assert.equal((await call('seen', { headers: auth })).code, 405);

// cron: needs secret, rotates cursor
assert.equal((await call('cron')).code, 401);
setLlm(async () => '[]');
const cr = await call('cron', { headers: { authorization: 'Bearer cs' }, query: { service: 'grants' } });
assert.equal(cr.json.out.grants.length, 3);
const cur = (await q("SELECT value FROM settings WHERE key='cursor:grants'"))[0].value;
assert.equal(cur, 3);

// config edit
await call('services', { method: 'PUT', headers: auth, body: { service: 'communities', queries: ['only this query'] } });
const sv2 = await call('services', { headers: auth });
assert.deepEqual(sv2.json.services.find((s) => s.id === 'communities').queries, ['only this query']);
console.log('ALL OK  (runs logged: ' + (await q('SELECT count(*)::int n FROM runs'))[0].n + ')');
process.exit(0);
