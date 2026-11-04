# Historica Analyst Hub (Vercel + Postgres)

`Business_analysis/` is the Vercel project root. Each search service lives in its own folder:

```
Business_analysis/
  public/index.html      the hub UI
  api/                   Vercel Functions (login, state, sync, services, run, cron)
  lib/                   db, auth, llm (OpenAI), pipeline, registry, shared helpers
  funds/                 Fund search      (new Vercel version of historica-grant-bot)
  conferences/           Conference search
  communities/           Community search
  social_analysis/       reserved for the social service (fb.py, linkedin.py - later)
  historica-grant-bot/   the old Telegram bot, untouched (not deployed)
  docs/                  reports and specs (not deployed)
```
Add a service: create `<folder>/index.js` (same shape as `funds/index.js`) and register it in `lib/registry.js`. `.vercelignore` keeps the old bot, docs and social scripts out of the deploy.

Dashboards, trackers and AI search services for Historica.

| Page | What it is |
|---|---|
| Search services | Fund search (ported from `historica-grant-bot`, no Telegram), Conference search, Community search. Run now or on a daily cron. Social search is reserved for later. |
| Conferences / Grants & Funding / Communities | Sortable, editable trackers. New finds from the services are marked **NEW** (✓ keep, ✕ hide). |
| Academic Outreach, Map Builder Testers, Templates & Letters, Funnels, Analytics | Ported from the demo. Analytics numbers are still demo data until tracking is connected. |

## How it works
- `public/index.html` — the hub UI. It syncs every edit to Postgres through `/api/sync` (only changed rows).
- `api/*.js` — Vercel Functions: `login`, `state`, `sync`, `services`, `run`, `cron`.
- `funds/`, `conferences/`, `communities/` — the three pipelines: profile + fixed sources + free-text queries → OpenAI (Responses API + `web_search` tool, `gpt-5-nano`, as in the bot) → JSON → filter → de-duplicate → `records` table. Fund search keeps the bot's rules (no consortium calls, no fellowships/fashion/volunteering, one-off programmes skipped once applied).
- Sources, queries and the profile are editable in the UI (Search services → “Sources, queries and profile”).
- Cron (`vercel.json`, daily 06:00 UTC): each service checks its next `CRON_CHUNK` (default 3) sources, then the cursor moves on. Every source is revisited every few days. Vercel Hobby allows daily crons.

## Deploy
1. `npm i -g vercel && cd Business_analysis && vercel` (create/link the project).
2. In the Vercel dashboard → **Storage** → add **Neon Postgres** (it sets `DATABASE_URL`). Tables are created automatically on the first request.
3. **Settings → Environment Variables**: `APP_PASSWORD`, `OPENAI_API_KEY`, `CRON_SECRET` (any long random string; Vercel sends it to the cron route), optionally `OPENAI_MODEL`, `CRON_CHUNK`, `SESSION_SECRET`. See `.env.example`.
4. `vercel --prod`. Open the URL, sign in with `APP_PASSWORD`. The first load seeds the universities, communities, templates and the four grants you already applied to.
5. Search services → **Run all** to fill the tables.

Function limit: each `/api/run` call checks one source (typically 10–40 s). `maxDuration` is set to 300 s in `vercel.json`.

## Local
- `npm test` — full API test on in-memory Postgres with a mocked OpenAI (auth, sync, dedupe, filters, cron cursor).
- `APP_PASSWORD=demo npm run dev` — local preview at http://localhost:3000 with in-memory data; uses canned search results unless `OPENAI_API_KEY` is set. Data resets on restart.

## Notes
- One shared password protects the whole app (cookie, 30 days). Add real auth before inviting others.
- Search results are AI-generated from web search: verify deadlines, sums and fees on the source page before acting.
- Re-importing the old bot's `data/seen.json` works from the Grants page (“Import bot seen.json”).
