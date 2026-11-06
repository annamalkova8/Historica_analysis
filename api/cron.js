import { ready } from '../_lib/db.js';
import { isCron } from '../_lib/auth.js';
import { serviceIds, runChunk } from '../_lib/pipeline.js';
import { syncJira, jiraConfigured } from '../_lib/jira.js';

/** Daily Vercel Cron: every service checks its next CRON_CHUNK tasks (cursor-based rotation). */
export default async function handler(req, res) {
  if (!isCron(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    await ready();
    const size = Math.max(1, Number(process.env.CRON_CHUNK) || 3);
    const only = req.query?.service;
    const out = {};
    for (const id of serviceIds().filter((s) => !only || s === only)) out[id] = await runChunk(id, size);
    if (!only && jiraConfigured()) out.jira = await syncJira('cron');
    return res.status(200).json({ ok: true, out });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
