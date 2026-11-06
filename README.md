# Historica Analyst Hub (Vercel + Postgres)

`Business_analysis/` is the Vercel project root. Each search service lives in its own folder:

```
Business_analysis/
  public/index.html      the hub UI
  api/                   Vercel Functions (login, state, sync, services, run, cron, jira)
  lib/                   db, auth, llm (OpenAI), jira, pipeline, registry, shared helpers
  funds/                 Fund search      (new Vercel version of historica-grant-bot)
  conferences/           Conference search
  communities/           Community search
  rivals/                Rivals analysis  (competing historical-map products)
  social_analysis/       reserved for the social service (fb.py, linkedin.py - later)
  historica-grant-bot/   the old Telegram bot, untouched (not deployed)
  _DOCS/                 reports, specs, DATABASE_SCHEMA.md (not deployed)
```
Add a service: create `<folder>/index.js` (same shape as `funds/index.js`) and register it in `lib/registry.js`. `.vercelignore` keeps the old bot, docs and social scripts out of the deploy.

Dashboards, trackers and AI search services for Historica.

| Page | What it is |
|---|---|
| Analytics (incl. **Funnels** tab) | Dashboards (demo numbers until tracking is live) and the Mixpanel-style funnel builder. |
| Project progress | Two tabs: **Roadmap** (editable board, status pills, live progress from Jira) and **Jira analytics** (per-person throughput, overdue, cycle time). Read-only Jira sync (env `JIRA_*`). |
| Rivals analysis | Rivals table (link, market, what's new, what we can take), Historica better/worse scorecard, map-quality benchmark (import the benchmark HTML reports). Fed by the **Rivals analysis** service. |
| Conferences / Grants & Funding / Communities | Sortable, editable trackers. New finds from the services are marked **NEW** (✓ keep, ✕ hide). |
| Academic Outreach, Map Builder Testers, Templates & Letters, Funnels, Analytics | Ported from the demo. Analytics numbers are still demo data until tracking is connected. |

## How it works
- `public/index.html` — the hub UI. It syncs every edit to Postgres through `/api/sync` (only changed rows).
- `api/*.js` — Vercel Functions: `login`, `state`, `sync`, `services`, `run`, `cron`.
- `funds/`, `conferences/`, `communities/` — the three pipelines: profile + fixed sources + free-text queries → OpenAI (Responses API + `web_search` tool, `gpt-5-nano`, as in the bot) → JSON → filter → de-duplicate → `records` table. Fund search keeps the bot's rules (no consortium calls, no fellowships/fashion/volunteering, one-off programmes skipped once applied).
- Sources, queries and the profile of each service live in code (`funds/`, `conferences/`, `communities/`, `rivals/`); the `/api/services` endpoint can still override them, but the UI page for it was removed.
- Cron (`vercel.json`, daily 06:00 UTC): each service checks its next `CRON_CHUNK` (default 3) sources, then the cursor moves on. Every source is revisited every few days. Vercel Hobby allows daily crons.

## Map quality (Project progress → Map quality)
Shows the quality-score formula, the before/after comparison of our maps (table per 100-year period: mean common score, best improved zone, worsened zone) and our comparison with rivals. The two **↻ Update** buttons read report files from your local folders **in the browser** (the deployed server cannot see your disk): pick `…/map_score_service/out` for before/after and `…/rivals_comparison` for rivals once (Chrome/Edge remember it; other browsers ask for the folder each time). New reports are added, changed ones refreshed. Where nothing is loaded yet the tab says "Data not enough to show".

## ↻ Update buttons
Every table tab that has a service has an **↻ Update** button: Conferences, Grants & Funding, Communities and Rivals run their search service (asks for confirmation first, because it uses OpenAI credits); Project progress pulls issues from Jira. Academic Outreach and Map Builder Testers are manual tables with no service. Database layout: `_DOCS/DATABASE_SCHEMA.md`.

## Deploy
1. `npm i -g vercel && cd Business_analysis && vercel` (create/link the project).
2. In the Vercel dashboard → **Storage** → add **Neon Postgres** (it sets `DATABASE_URL`). Tables are created automatically on the first request.
3. **Settings → Environment Variables**: `APP_PASSWORD`, `OPENAI_API_KEY`, `CRON_SECRET` (any long random string; Vercel sends it to the cron route), for Jira `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT` (or `JIRA_JQL`), optionally `OPENAI_MODEL`, `CRON_CHUNK`, `SESSION_SECRET`. See `.env.example`.
4. `vercel --prod`. Open the URL, sign in with `APP_PASSWORD`. The first load seeds the universities, communities, templates and the four grants you already applied to.
5. On each table tab (Conferences, Grants, Communities, Rivals) press **↻ Update** to fill it.

Function limit: each `/api/run` call checks one source (typically 10–40 s). `maxDuration` is set to 300 s in `vercel.json`.

## Local
- `npm test` — full API test on in-memory Postgres with a mocked OpenAI (auth, sync, dedupe, filters, cron cursor).
- `APP_PASSWORD=demo npm run dev` — local preview at http://localhost:3000 with in-memory data; uses canned search results unless `OPENAI_API_KEY` is set. Data resets on restart.

## Duplicates and "never show again"
- Every search checks new finds against **all** rows already in the table, hidden ones included, using `lib/dedupe.js`: same URL, or names that are the same after dropping filler words (grant/fund/call/foundation/…), with different years treated as different calls. Near-duplicates are skipped ("N duplicates skipped" in the Update log).
- **Find duplicates** (Grants, Conferences, Communities) previews groups, then *hides* the copies (filter *Hidden*, ↩ restores); the row with progress (applied/result) or the most filled fields is kept and gets missing fields filled in.
- **🚫 Never show again** hides a row permanently but keeps it in the database so searches cannot add it back. 🗑 deletes for real (a later search may re-find it).
- Why not sentence-transformers: it is a Python/local-model stack and does not run in Vercel's Node functions. If rules are not enough, OpenAI embeddings (`text-embedding-3-small`, same API key) can be added to the same hook (`similar` in `funds/index.js`).

## Notes
- One shared password protects the whole app (cookie, 30 days). Add real auth before inviting others.
- Search results are AI-generated from web search: verify deadlines, sums and fees on the source page before acting.
- The old bot's history (`funds/seen-data.js`, a snapshot of `historica-grant-bot/data/seen.json`) is imported automatically by Grants → ↻ Update (idempotent; applied/hidden carried over). If the bot keeps running elsewhere, copy its newer `seen.json` entries into that file and redeploy.
