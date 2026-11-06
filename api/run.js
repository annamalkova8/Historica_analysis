import { ready } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { SERVICES } from '../_lib/registry.js';
import { runTask } from '../_lib/pipeline.js';

/** POST {service, task} -> runs one source/query task (the UI loops over tasks to show progress). */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!SERVICES[b.service]) return res.status(400).json({ error: 'unknown service' });
    const out = await runTask(b.service, Number(b.task), 'manual');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
