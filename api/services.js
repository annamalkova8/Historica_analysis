import { q, ready, setSetting } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { SERVICES } from '../lib/registry.js';
import { getConfig, tasksOf, serviceIds } from '../lib/pipeline.js';

/** GET -> services with tasks, last runs.  PUT {service, profile?, sources?, queries?} -> save edits.  DELETE ?service= -> reset to defaults. */
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    await ready();
    if (req.method === 'PUT') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!SERVICES[b.service]) return res.status(400).json({ error: 'unknown service' });
      const v = {};
      if (typeof b.profile === 'string') v.profile = b.profile;
      if (Array.isArray(b.sources) && b.sources.every((s) => s && typeof s.name === 'string')) v.sources = b.sources;
      if (Array.isArray(b.queries) && b.queries.every((s) => typeof s === 'string')) v.queries = b.queries;
      await setSetting(`service:${b.service}`, v);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.service;
      if (!SERVICES[id]) return res.status(400).json({ error: 'unknown service' });
      await setSetting(`service:${id}`, {});
      return res.status(200).json({ ok: true });
    }
    const runs = await q('SELECT id, service, task, trigger, started_at, finished_at, found, added, error FROM runs ORDER BY id DESC LIMIT 40');
    const services = [];
    for (const id of serviceIds()) {
      const cfg = await getConfig(id);
      services.push({
        id, title: cfg.title, description: cfg.description, collection: cfg.collection,
        profile: cfg.profile, sources: cfg.sources, queries: cfg.queries, customized: cfg.customized,
        tasks: tasksOf(cfg).map((t) => t.name),
        lastRun: runs.find((r) => r.service === id)?.started_at || null,
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ services, runs, llmConfigured: !!process.env.OPENAI_API_KEY });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
