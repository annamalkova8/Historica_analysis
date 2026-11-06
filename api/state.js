import { q, ready, getSetting } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { COLLECTIONS } from '../_lib/registry.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    const rows = await q('SELECT id, kind, data FROM records ORDER BY created_at, id');
    const data = Object.fromEntries(COLLECTIONS.map((k) => [k, []]));
    for (const r of rows) if (data[r.kind]) data[r.kind].push({ ...r.data, _id: r.id });
    const seeded = !!(await getSetting('seeded', false));
    res.setHeader('Cache-Control', 'no-store');
    const seededKinds = (await getSetting('seeded_kinds', [])) || [];
    return res.status(200).json({ data, seeded, seededKinds });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
