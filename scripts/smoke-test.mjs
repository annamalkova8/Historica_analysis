// Local smoke test: in-memory Postgres (PGlite) + mocked OpenAI. No network, no keys needed.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
process.env.APP_PASSWORD = 'pw'; process.env.CRON_SECRET = 'cs';

const { setDb, ready, q } = await import('../lib/db.js');
const { setLlm } = await import('../lib/llm.js');
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
assert.equal(sv.json.services.length, 3);
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
