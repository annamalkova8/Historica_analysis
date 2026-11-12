// Google Analytics 4 sync (read-only). Uses a service account with the Viewer role on the GA4 property and the
// Analytics Data API (REST, no extra dependencies). The result is one JSON snapshot stored in settings key "ga:data".
//
// Env: GA_PROPERTY_ID (number from GA -> Admin -> Property details),
//      GA_SERVICE_ACCOUNT_JSON (the whole key file content; set it in Vercel only - never commit it)
//      or, for local use only, GA_KEY_FILE (path to the key file).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { getSetting, setSetting, q } from './db.js';

let override = null;
export function setGa(fn) { override = fn; } // tests / local preview: async () => snapshot

const propertyId = () => String(process.env.GA_PROPERTY_ID || '').replace(/\D/g, '');
function creds() {
  try {
    const raw = process.env.GA_SERVICE_ACCOUNT_JSON || (process.env.GA_KEY_FILE ? fs.readFileSync(process.env.GA_KEY_FILE, 'utf8') : '');
    const j = raw ? JSON.parse(raw) : null;
    return j && j.client_email && j.private_key ? j : null;
  } catch { return null; }
}
export const gaConfigured = () => !!(override || (propertyId() && creds()));

const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
async function accessToken() {
  const c = creds(), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(c.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google sign-in failed (${r.status}): ${j.error_description || j.error || r.statusText}`);
  return j.access_token;
}

async function report(token, body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId()}:runReport`, {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ limit: 100, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const why = { 403: 'the service account is not a Viewer of this property, or the Analytics Data API is not enabled', 404: 'property not found - check GA_PROPERTY_ID', 400: 'bad request' }[r.status] || '';
    throw new Error(`GA ${r.status}${why ? ' (' + why + ')' : ''}: ${j.error?.message || r.statusText}`);
  }
  const dims = (j.dimensionHeaders || []).map((h) => h.name), mets = (j.metricHeaders || []).map((h) => h.name);
  return (j.rows || []).map((row) => {
    const o = {};
    dims.forEach((d, i) => { o[d] = row.dimensionValues[i].value; });
    mets.forEach((m, i) => { o[m] = Number(row.metricValues[i].value) || 0; });
    return o;
  });
}

const M = ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate'];
const range = (a, b = 'today') => [{ startDate: a, endDate: b }];
const BREAKDOWNS = {
  channels: ['sessionDefaultChannelGroup'], sources: ['sessionSourceMedium'], campaigns: ['sessionCampaignName'],
  countries: ['country'], cities: ['city'], devices: ['deviceCategory'], browsers: ['browser'], languages: ['language'],
  hosts: ['hostName'], returning: ['newVsReturning'],
  pages: ['pagePath'], landing: ['landingPagePlusQueryString'],
};

export async function fetchSnapshot() {
  const token = await accessToken();
  const R = (b) => report(token, b);
  const orderBy = [{ metric: { metricName: 'sessions' }, desc: true }];
  const snap = { property: propertyId(), at: new Date().toISOString() };
  // totals for 7 / 30 / 90 days (one row per range)
  const tot = await R({
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today', name: 'd7' }, { startDate: '30daysAgo', endDate: 'today', name: 'd30' }, { startDate: '90daysAgo', endDate: 'today', name: 'd90' }],
    metrics: ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'eventCount', 'averageSessionDuration', 'bounceRate'].map((name) => ({ name })),
  }).catch((e) => { throw e; });
  snap.totals = tot;
  snap.daily = await R({ dateRanges: range('364daysAgo'), dimensions: [{ name: 'date' }], metrics: ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagedSessions'].map((name) => ({ name })), orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 });
  for (const [k, dims] of Object.entries(BREAKDOWNS)) {
    snap[k] = await R({ dateRanges: range('89daysAgo'), dimensions: dims.map((name) => ({ name })), metrics: M.map((name) => ({ name })), orderBys: orderBy, limit: k === 'pages' || k === 'landing' ? 50 : 30 });
  }
  snap.events = await R({ dateRanges: range('89daysAgo'), dimensions: [{ name: 'eventName' }], metrics: ['eventCount', 'totalUsers'].map((name) => ({ name })), orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 60 });
  // the same property carries two sites: www.historica.org (website) and map.historica.org (the map)
  const mapHost = { filter: { fieldName: 'hostName', stringFilter: { matchType: 'BEGINS_WITH', value: 'map.' } } };
  const flt = { site: { notExpression: mapHost }, map: mapHost };
  snap.scopes = {};
  for (const [name, dimensionFilter] of Object.entries(flt)) {
    const S = {}, F = (b) => R({ dimensionFilter, ...b });
    S.totals = await F({
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today', name: 'd7' }, { startDate: '30daysAgo', endDate: 'today', name: 'd30' }, { startDate: '60daysAgo', endDate: '31daysAgo', name: 'p30' }, { startDate: '90daysAgo', endDate: 'today', name: 'd90' }],
      metrics: ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'userEngagementDuration', 'averageSessionDuration'].map((n) => ({ name: n })),
    });
    S.daily = await F({ dateRanges: range('181daysAgo'), dimensions: [{ name: 'date' }], metrics: ['activeUsers', 'sessions'].map((n) => ({ name: n })), orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 });
    for (const [k, dims] of Object.entries({ channels: ['sessionDefaultChannelGroup'], devices: ['deviceCategory'], returning: ['newVsReturning'], countries: ['country'], pages: ['pagePath'] })) {
      S[k] = await F({ dateRanges: range('29daysAgo'), dimensions: dims.map((n) => ({ name: n })), metrics: M.map((n) => ({ name: n })), orderBys: orderBy, limit: 20 });
    }
    S.events = await F({ dateRanges: range('29daysAgo'), dimensions: [{ name: 'eventName' }], metrics: ['eventCount', 'totalUsers'].map((n) => ({ name: n })), orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 30 });
    snap.scopes[name] = S;
  }
  return snap;
}

export async function syncGa(trigger = 'manual') {
  if (!gaConfigured()) throw new Error('Google Analytics is not configured (set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON)');
  const run = (await q('INSERT INTO runs (service, task, trigger) VALUES ($1,$2,$3) RETURNING id', ['ga', 'Sync reports', trigger]))[0];
  let error = null, count = 0;
  try {
    const snap = await (override ? override() : fetchSnapshot());
    count = (snap.daily || []).length;
    await setSetting('ga:data', snap);
    await setSetting('ga:last', { at: snap.at, days: count });
  } catch (e) {
    error = String(e?.message || e).slice(0, 500);
  }
  await q('UPDATE runs SET finished_at=now(), found=$2, added=$2, error=$3 WHERE id=$1', [run.id, count, error]);
  return { count, error };
}

export async function gaStatus() {
  return { configured: gaConfigured(), last: await getSetting('ga:last', null), data: await getSetting('ga:data', null) };
}
