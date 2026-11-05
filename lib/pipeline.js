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
  let found = 0, added = 0, updated = 0, dups = 0, error = null;
  const names = [];
  try {
    const src = task.type === 'source' ? cfg.sources[task.index] : null;

    // One-off programmes (e.g. AWS Activate): skip once applied or hidden.
    if (src?.single_program) {
      const r = await q(
        `SELECT 1 FROM records WHERE kind=$1 AND data->>'source'=$2
           AND (data->>'hidden'='true' OR data->>'applied'='Yes') LIMIT 1`, [cfg.collection, src.name]);
      if (r.length) return await finish(run.id, { found, added, updated, error, names, task: task.name, skipped: true });
    }

    const prompt = `${cfg.system(cfg.profile)}\n\n---\n\n${src ? cfg.sourcePrompt(src) : cfg.queriesPrompt(cfg.queries)}`;
    const items = extractJsonArray(await callLlm(prompt, src ? 'low' : 'medium')).filter((it) => cfg.accept(it));
    found = items.length;

    const rows = await q('SELECT id, key, data FROM records WHERE kind=$1', [cfg.collection]);
    const existing = new Map(rows.map((r) => [r.key, r.id]));
    const known = rows.map((r) => r.data);   // includes hidden ("never show again") rows, so near-duplicates of those are skipped too
    const fresh = new Set();
    const day = new Date().toISOString().slice(0, 10);
    for (const it of items) {
      const key = cfg.key(it);
      if (!key) continue;
      if (existing.has(key)) {
        // Services with a refresh() hook update known rows (e.g. rivals: what's new) instead of skipping them.
        if (cfg.refresh && !fresh.has(key)) {
          await q(`UPDATE records SET data = data || $2::jsonb, updated_at = now() WHERE id=$1`, [existing.get(key), JSON.stringify(cfg.refresh(it, task.name))]);
          updated++;
        }
        continue;
      }
      const rec = cfg.toRecord(it, task.name);
      if (cfg.similar && known.some((k) => cfg.similar(rec, k))) { dups++; continue; }   // fuzzy duplicate of an existing row
      const id = 'p_' + randomUUID();
      existing.set(key, id); fresh.add(key);
      const data = { ...rec, isNew: true, found: 'ai', firstSeen: day };
      known.push(data);
      await q('INSERT INTO records (id, kind, key, data) VALUES ($1,$2,$3,$4::jsonb)',
        [id, cfg.collection, key, JSON.stringify(data)]);
      added++; names.push(data.name);
    }
  } catch (e) {
    error = String(e?.message || e).slice(0, 500);
  }
  return finish(run.id, { found, added, updated, dups, error, names, task: task.name });
}

async function finish(runId, r) {
  await q('UPDATE runs SET finished_at=now(), found=$2, added=$3, error=$4 WHERE id=$1', [runId, r.found, r.added + (r.updated || 0), r.error]);
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
