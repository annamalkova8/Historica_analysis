import { q, ready, getSetting, setSetting } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { SYNCABLE, keyForRecord } from '../_lib/registry.js';

const MAX = 500;

/** Client sends only what changed: { upserts:[{kind,id,data}], deletes:[{kind,id}], markSeeded? } */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const ups = (b.upserts || []).filter((u) => SYNCABLE.includes(u.kind) && typeof u.id === 'string' && u.data && typeof u.data === 'object').slice(0, MAX);
    const dels = (b.deletes || []).filter((d) => SYNCABLE.includes(d.kind) && typeof d.id === 'string').slice(0, MAX);

    if (ups.length) {
      const clean = ups.map((u) => { const { _id, ...rest } = u.data; return { ...u, data: rest }; });
      await q(
        `INSERT INTO records (id, kind, key, data)
         SELECT id, kind, nullif(key,''), data::jsonb FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS t(id, kind, key, data)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, key = EXCLUDED.key, updated_at = now()`,
        [clean.map((u) => u.id), clean.map((u) => u.kind), clean.map((u) => keyForRecord(u.kind, u.data) || ''), clean.map((u) => JSON.stringify(u.data))],
      );
    }
    if (dels.length) await q('DELETE FROM records WHERE id = ANY($1::text[])', [dels.map((d) => d.id)]);
    if (b.markSeeded) await setSetting('seeded', true);
    if (Array.isArray(b.markSeededKinds) && b.markSeededKinds.length) {
      const cur = new Set((await getSetting('seeded_kinds', [])) || []);
      b.markSeededKinds.filter((k) => SYNCABLE.includes(k)).forEach((k) => cur.add(k));
      await setSetting('seeded_kinds', [...cur]);
    }
    return res.status(200).json({ ok: true, upserts: ups.length, deletes: dels.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
