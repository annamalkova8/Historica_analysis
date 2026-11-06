// Fuzzy duplicate detection for opportunities (grants, conferences, communities).
// Deterministic and dependency-free so it runs in a Vercel function: shared-token overlap + character
// trigrams on the *meaningful* words of a name, plus exact-URL match. (Sentence-transformers are a Python
// stack and cannot run here; see README "Duplicates" for the embeddings option if this is not enough.)

const STOP = new Set(('the of for and to in a an on at by with from or program programme programs call calls open fund funds funding grant grants award awards ' +
  'application applications round edition cohort new annual international conference conferences meeting symposium workshop congress summit foundation').split(' '));
const strip = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const YEAR = /^(19|20)\d\d$/;

export function tokens(name) {
  const all = strip(name).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const years = new Set(all.filter((t) => YEAR.test(t)));
  const words = new Set(all.filter((t) => !YEAR.test(t) && !STOP.has(t) && t.length > 1 && !/^\d+(st|nd|rd|th)$/.test(t) && !/^\d$/.test(t)));
  return { words, years };
}
const trigrams = (s) => { const t = ` ${s} `, o = new Set(); for (let i = 0; i < t.length - 2; i++) o.add(t.slice(i, i + 3)); return o; };
const dice = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return (2 * n) / (a.size + b.size); };

/** URL for equality: no protocol/www/utm params/trailing slash, but the #fragment is kept (ngi.eu/opencalls/#CodeSupply != #OIS-Restack). */
export function urlKey(u) {
  return strip(u).replace(/\s.*$/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/([?&])utm_[^&#]*/g, '$1').replace(/[?&]+(#|$)/, '$1').replace(/\/+(#|$)/, '$1');
}
const hasPath = (k) => /\//.test(k.replace(/#.*$/, '')) || /#./.test(k);

/** Do two names describe the same opportunity? Different explicit years => different (annual calls are separate opportunities). */
export function sameName(a, b) {
  const A = tokens(a), B = tokens(b);
  if (A.years.size && B.years.size && ![...A.years].some((y) => B.years.has(y))) return false;
  const [s, l] = A.words.size <= B.words.size ? [A.words, B.words] : [B.words, A.words];
  if (!s.size) return false;
  const inter = [...s].filter((w) => l.has(w)).length;
  const jaccard = inter / (s.size + l.size - inter);
  if (jaccard >= 0.75) return true;
  if (s.size >= 2 && inter === s.size) return true;                      // the shorter name is fully contained in the longer one
  return dice(trigrams([...A.words].sort().join(' ')), trigrams([...B.words].sort().join(' '))) >= 0.9;   // typos / spelling variants
}

export function sameGrant(a, b) {
  const ua = urlKey(a.link), ub = urlKey(b.link);
  if (ua && ua === ub && ua !== '#' && hasPath(ua)) return true;
  return sameName(a.name, b.name);
}
export function sameConf(a, b) {
  const da = Date.parse(a.date), db = Date.parse(b.date);
  if (!isNaN(da) && !isNaN(db) && Math.abs(da - db) > 60 * 864e5) return false;   // same series, different edition
  const ua = urlKey(a.link), ub = urlKey(b.link);
  if (ua && ua === ub && hasPath(ua) && (isNaN(da) || isNaN(db))) return true;
  return sameName(a.name, b.name);
}
export function sameComm(a, b) {
  const ua = urlKey(a.url), ub = urlKey(b.url);
  if (ua && ua === ub && ua !== '#' && hasPath(ua)) return true;
  return strip(a.name).replace(/[^a-z0-9]/g, '') === strip(b.name).replace(/[^a-z0-9]/g, '');
}

const EMPTY = new Set(['', 'unknown', '?', 'to check', '—', 'tbd']);
const MERGE_FIELDS = ['deadline', 'sum', 'period', 'docs', 'note', 'oss', 'articles'];
const progress = (d) => (d.applied === 'Yes' || d.applied === 'Planned' || (d.result && d.result !== '—') ? 1 : 0);
const filled = (d) => Object.values(d).filter((v) => v !== undefined && !EMPTY.has(String(v).toLowerCase())).length;

/** rows: [{id, data, created_at}] -> clusters of duplicates with the row to keep and the rows to hide. */
export function findDuplicates(rows, same) {
  const parent = rows.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) if (same(rows[i].data, rows[j].data)) parent[find(i)] = find(j);
  const groups = new Map();
  rows.forEach((r, i) => { const k = find(i); (groups.get(k) || groups.set(k, []).get(k)).push(r); });
  const out = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const ranked = [...g].sort((a, b) => progress(b.data) - progress(a.data) || filled(b.data) - filled(a.data) || String(a.created_at).localeCompare(String(b.created_at)));
    const keep = ranked[0];
    const neverShow = g.some((r) => r.data.hidden && !r.data.dupOf) && !progress(keep.data);   // user hid one copy -> hide the whole cluster
    out.push({ keep, drop: ranked.slice(1), neverShow });
  }
  return out;
}

/** Patch for the kept row: fill unknown fields from the dropped copies. */
export function mergePatch(keep, drop) {
  const p = {};
  for (const f of MERGE_FIELDS) {
    if (!EMPTY.has(String(keep.data[f] ?? '').toLowerCase())) continue;
    const v = drop.map((d) => d.data[f]).find((x) => x !== undefined && !EMPTY.has(String(x).toLowerCase()));
    if (v !== undefined) p[f] = v;
  }
  return p;
}
