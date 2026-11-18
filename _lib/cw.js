// AWS CloudWatch sync (read-only): daily map traffic from the custom metrics Historica/SEO -> MapDailySessions / MapDailyVisitors.
// Plain REST + SigV4 (no AWS SDK dependency). The result is one JSON snapshot stored in settings key "cw:data".
//
// Env (Vercel reserves the AWS_* names, so these have a CW_ prefix):
//   CW_AWS_ACCESS_KEY_ID, CW_AWS_SECRET_ACCESS_KEY  - an IAM user that may call cloudwatch:GetMetricData (read-only)
//   CW_AWS_REGION       - default eu-central-1
//   CW_NAMESPACE        - default Historica/SEO
import crypto from 'node:crypto';
import { getSetting, setSetting, q } from './db.js';

let override = null;
export function setCw(fn) { override = fn; } // tests / local preview: async () => snapshot

const cfg = () => ({
  key: process.env.CW_AWS_ACCESS_KEY_ID || '', secret: process.env.CW_AWS_SECRET_ACCESS_KEY || '', token: process.env.CW_AWS_SESSION_TOKEN || '',
  region: process.env.CW_AWS_REGION || 'eu-central-1', ns: process.env.CW_NAMESPACE || 'Historica/SEO',
});
export const cwConfigured = () => !!(override || (cfg().key && cfg().secret));

const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function cwCall(target, payload) {
  const c = cfg(), host = `monitoring.${c.region}.amazonaws.com`, body = JSON.stringify(payload);
  const amz = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), day = amz.slice(0, 8);
  const headers = { 'content-type': 'application/x-amz-json-1.0', host, 'x-amz-date': amz, 'x-amz-target': 'GraniteServiceVersion20100801.' + target };
  if (c.token) headers['x-amz-security-token'] = c.token;
  const names = Object.keys(headers).sort();
  const canon = ['POST', '/', '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), sha(body)].join('\n');
  const scope = `${day}/${c.region}/monitoring/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', amz, scope, sha(canon)].join('\n');
  const sk = hmac(hmac(hmac(hmac('AWS4' + c.secret, day), c.region), 'monitoring'), 'aws4_request');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${c.key}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hmac(sk, sts).toString('hex')}`;
  const r = await fetch(`https://${host}/`, { method: 'POST', headers, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`CloudWatch ${r.status}${j.__type ? ' (' + String(j.__type).split('#').pop() + ')' : ''}: ${j.message || j.Message || r.statusText}`);
  return j;
}

const METRICS = { sessions: 'MapDailySessions', visitors: 'MapDailyVisitors' };

/** Daily values for the last `days` days (UTC, today excluded). A day missing in CloudWatch stays null. */
export async function fetchSnapshot(days = 450) {
  const c = cfg(), end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - days * 864e5);
  const queries = Object.entries(METRICS).map(([id, MetricName]) => ({ Id: id, MetricStat: { Metric: { Namespace: c.ns, MetricName }, Period: 86400, Stat: 'Sum' } }));
  const byDay = {}, seen = {};
  let token;
  do {
    const j = await cwCall('GetMetricData', { MetricDataQueries: queries, StartTime: start.getTime() / 1000, EndTime: end.getTime() / 1000, ScanBy: 'TimestampAscending', ...(token ? { NextToken: token } : {}) });
    for (const m of j.MetricDataResults || []) {
      (m.Timestamps || []).forEach((t, i) => { const d = new Date(t * 1000).toISOString().slice(0, 10); (byDay[d] ||= {})[m.Id] = m.Values[i]; seen[m.Id] = true; });
    }
    token = j.NextToken;
  } while (token);
  const missing = Object.keys(METRICS).filter((k) => !seen[k]);
  if (missing.length === Object.keys(METRICS).length) throw new Error(`CloudWatch returned no data for ${c.ns} (check CW_NAMESPACE / CW_AWS_REGION)`);
  const daily = Object.keys(byDay).sort().map((date) => ({ date, sessions: byDay[date].sessions ?? null, visitors: byDay[date].visitors ?? null }));
  return { at: new Date().toISOString(), namespace: c.ns, region: c.region, daily };
}

export async function syncCw(trigger = 'manual') {
  if (!cwConfigured()) throw new Error('CloudWatch is not configured (set CW_AWS_ACCESS_KEY_ID and CW_AWS_SECRET_ACCESS_KEY)');
  const run = (await q('INSERT INTO runs (service, task, trigger) VALUES ($1,$2,$3) RETURNING id', ['cw', 'Sync map traffic', trigger]))[0];
  let error = null, count = 0;
  try {
    const snap = await (override ? override() : fetchSnapshot());
    count = snap.daily.length;
    await setSetting('cw:data', snap);
    await setSetting('cw:last', { at: snap.at, days: count });
  } catch (e) {
    error = String(e?.message || e).slice(0, 500);
  }
  await q('UPDATE runs SET finished_at=now(), found=$2, added=$2, error=$3 WHERE id=$1', [run.id, count, error]);
  return { count, error };
}

export async function cwStatus() {
  return { configured: cwConfigured(), last: await getSetting('cw:last', null), data: await getSetting('cw:data', null) };
}
