import { ready } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { importSeen } from '../lib/seen.js';

/** POST -> import the old bot's history into the grants table (idempotent). Called automatically by the Grants "Update" button. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    return res.status(200).json(await importSeen());
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
