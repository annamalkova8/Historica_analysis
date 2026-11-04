import { randomUUID } from 'node:crypto';
import { q, getSetting, setSetting } from './db.js';
import { callLlm, extractJsonArray } from './llm.js';
import { SERVICES, keyForRecord } from './registry.js';

export function serviceIds() { return Object.keys(SERVICES); }

/** Service definition merged with edits saved from the UI (profile / sources / queries). */
export async function getConfig(id) {
  const base = SERVICES[id];
  if (!base) throw new Error(`Unknown service: ${id}`);
  const o = (await getSetting(`service:${id}`, {})) || {};
  return {
    ...base,
    profile: typeof o.profile === 'string' && o.profile.trim() ? o.profile : base.profile,
    sources: Array.isArray(o.sources) ? o.sources : base.sources,
    queries: Array.isArray(o.queries) ? o.queries : base.queries,
    customized: !!(o.profile || o.sources || o.queries),
  };
}

export function tasksOf(cfg) {
  const t = cfg.sources.map((s, i) => ({ type: 'source', index: i, name: s.name }));
  if (cfg.queries.length) t.push({ type: 'queries', name: 'Open web search' });
  return t;
}

/** Run ONE task (a source, or the free-text queries) and store new, de-duplicated records. */
export async function runTask(id, taskIndex, trigger = 'manual') {
  const cfg = await getConfig(id);
  const tasks = tasksOf(cfg);
  const task = tasks[taskIndex];
  if (!task) throw new Error(`Service ${id} has no task #${taskIndex}`);

  const run = (await q(
    'INSERT INTO runs (service, task, trigger) VALUES ($1,$2,$3) RETURNING id', [id, task.name, trigger],
  ))[0];
  let found = 0, added = 0, error = null;
  const names = [];
  try {
    const src = task.type === 'source' ? cfg.sources[task.index] : null;

    // One-off programmes (e.g. AWS Activate): skip once applied or hidden.
    if (src?.single_program) {
      const r = await q(
        `SELECT 1 FROM records WHERE kind=$1 AND data->>'source'=$2
           AND (data->>'hidden'='true' OR data->>'applied'='Yes') LIMIT 1`, [cfg.collection, src.name]);
      if (r.length) return await finish(run.id, { found, added, error, names, task: task.name, skipped: true });
    }

    const prompt = `${cfg.system(cfg.profile)}\n\n---\n\n${src ? cfg.sourcePrompt(src) : cfg.queriesPrompt(cfg.queries)}`;
    const items = extractJsonArray(await callLlm(prompt, src ? 'low' : 'medium')).filter((it) => cfg.accept(it));
    found = items.length;

    const existing = new Set((await q('SELECT key FROM records WHERE kind=$1', [cfg.collection])).map((r) => r.key));
    const day = new Date().toISOString().slice(0, 10);
    for (const it of items) {
      const key = cfg.key(it);
      if (!key || existing.has(key)) continue;
      existing.add(key);
      const data = { ...cfg.toRecord(it, task.name), isNew: true, found: 'ai', firstSeen: day };
      await q('INSERT INTO records (id, kind, key, data) VALUES ($1,$2,$3,$4::jsonb)',
        ['p_' + randomUUID(), cfg.collection, key, JSON.stringify(data)]);
      added++; names.push(data.name);
    }
  } catch (e) {
    error = String(e?.message || e).slice(0, 500);
  }
  return finish(run.id, { found, added, error, names, task: task.name });
}

async function finish(runId, r) {
  await q('UPDATE runs SET finished_at=now(), found=$2, added=$3, error=$4 WHERE id=$1', [runId, r.found, r.added, r.error]);
  return r;
}

/** Cron: each service advances a cursor and checks the next few tasks, so a long source list
 *  fits inside the function time limit and is covered over several days. */
export async function runChunk(id, size) {
  const cfg = await getConfig(id);
  const n = tasksOf(cfg).length;
  if (!n) return [];
  const cur = Number((await getSetting(`cursor:${id}`, 0)) || 0) % n;
  const idxs = Array.from({ length: Math.min(size, n) }, (_, i) => (cur + i) % n);
  await setSetting(`cursor:${id}`, (cur + idxs.length) % n);
  const res = await Promise.allSettled(idxs.map((i) => runTask(id, i, 'cron')));
  return res.map((r, k) => (r.status === 'fulfilled' ? r.value : { task: `#${idxs[k]}`, error: String(r.reason) }));
}

/** Normalised key helper re-exported for the sync endpoint. */
export { keyForRecord };
