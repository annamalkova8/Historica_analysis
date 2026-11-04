import { q, ready, getSetting } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { COLLECTIONS } from '../lib/registry.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    const rows = await q('SELECT id, kind, data FROM records ORDER BY created_at, id');
    const data = Object.fromEntries(COLLECTIONS.map((k) => [k, []]));
    for (const r of rows) if (data[r.kind]) data[r.kind].push({ ...r.data, _id: r.id });
    const seeded = !!(await getSetting('seeded', false));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ data, seeded });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
