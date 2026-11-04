// Local preview without Vercel or Neon: in-memory Postgres (PGlite) + the real API handlers.
// If OPENAI_API_KEY is not set, searches return canned demo results.
//   APP_PASSWORD=demo npm run dev     ->  http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

process.env.APP_PASSWORD ||= 'demo';
process.env.CRON_SECRET ||= 'local-cron';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { setDb } = await import('../lib/db.js');
const { setLlm } = await import('../lib/llm.js');
const pg = new PGlite();
setDb({ query: async (t, p) => (await pg.query(t, p)).rows });

if (!process.env.OPENAI_API_KEY) {
  console.log('No OPENAI_API_KEY: using canned demo search results.');
  setLlm(async (prompt) => {
    await new Promise((r) => setTimeout(r, 400));
    if (prompt.includes('conferences')) return JSON.stringify([{ name: 'Digital Humanities 2027', link: 'https://adho.org/conference/', start_date: '2027-07-05', location: 'Europe', format: 'in-person', cfp_deadline: '2026-12-01', cost: 'EUR 450', topics: 'digital humanities', relevance_note: 'Demo result: talk or poster on Map Builder.' }]);
    if (prompt.includes('communities')) return JSON.stringify([{ name: 'r/historyteachers', platform: 'Reddit', audience: 'School history teachers', url: 'https://www.reddit.com/r/historyteachers/', rules: 'unknown - check before posting', goal: 'Feedback', priority: 'Very high', best_approach: 'Share a classroom activity', relevance_note: 'Demo result.' }]);
    return JSON.stringify([{ name: 'Demo Open Call', link: 'https://example.org/call', deadline: '2027-02-01', sum: 'EUR 30,000', period: '9 months', open_source_required: 'yes', scientific_articles_required: 'no', consortium_required: 'no', documents_required: ['proposal', 'budget'], relevance_note: 'Demo result.' }]);
  });
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
    let body = '';
    for await (const c of req) body += c;
    try {
      const mod = await import(`../api/${name}.js`);
      const r = { status(c) { res.statusCode = c; return r; }, json(j) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(j)); return r; }, setHeader: (k, v) => res.setHeader(k, v.replace?.('; Secure', '') ?? v) };
      await mod.default({ method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : undefined }, r);
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message) })); }
    return;
  }
  const file = path.join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
}).listen(process.env.PORT || 3000, () => console.log(`Hub preview: http://localhost:${process.env.PORT || 3000}  (password: ${process.env.APP_PASSWORD})`));
