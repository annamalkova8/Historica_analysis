import { q, ready } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { findDuplicates, mergePatch, sameGrant, sameConf, sameComm } from '../_lib/dedupe.js';

const SAME = { grants: sameGrant, confs: sameConf, comms: sameComm };

/** POST {kind, apply?} -> finds fuzzy duplicates. Without apply: preview only. With apply: duplicates are HIDDEN
 *  (never deleted; `dupOf` names the row that was kept) and unknown fields of the kept row are filled from them. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!SAME[b.kind]) return res.status(400).json({ error: 'kind must be grants, confs or comms' });
    const rows = await q('SELECT id, data, created_at FROM records WHERE kind=$1 ORDER BY created_at, id', [b.kind]);
    const groups = [];
    for (const c of findDuplicates(rows, SAME[b.kind])) {
      const todo = c.drop.filter((d) => !d.data.hidden);
      const hideKeep = c.neverShow && !c.keep.data.hidden;
      if (!todo.length && !hideKeep) continue;
      groups.push({ keep: c.keep.data.name, drop: todo.map((d) => d.data.name), neverShow: hideKeep, _c: c, _todo: todo });
    }
    let hidden = 0;
    if (b.apply) {
      const day = new Date().toISOString().slice(0, 10);
      for (const g of groups) {
        const patch = { ...mergePatch(g._c.keep, g._c.drop), ...(g.neverShow ? { hidden: true, isNew: false, hiddenAt: day } : {}) };
        if (Object.keys(patch).length) await q(`UPDATE records SET data = data || $2::jsonb, updated_at = now() WHERE id=$1`, [g._c.keep.id, JSON.stringify(patch)]);
        for (const d of g._todo) {
          await q(`UPDATE records SET data = data || $2::jsonb, updated_at = now() WHERE id=$1`, [d.id, JSON.stringify({ hidden: true, isNew: false, dupOf: g.keep, hiddenAt: day })]);
          hidden++;
        }
      }
    }
    return res.status(200).json({ applied: !!b.apply, hidden, groups: groups.map(({ _c, _todo, ...g }) => g) });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
