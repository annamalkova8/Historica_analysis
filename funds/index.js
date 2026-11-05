// Fund search: ported from historica-grant-bot (OpenAI web search, no Telegram).
import cfg from './config.js';
import { sameGrant } from '../lib/dedupe.js';
import { today, str, yn, normUrl, normName, money, HISTORICA, JSON_ONLY } from '../lib/shared.js';
export default {
  id: 'grants',
  title: 'Fund search',
  collection: 'grants',
  description: 'Open grants, calls and startup programmes that a 3-person team can apply to alone. Ported from historica-grant-bot (no Telegram).',
  profile: cfg.profile,
  sources: cfg.sources,
  queries: cfg.queries,
  system(profile) {
    return `You are a research assistant helping a small open-source project find grant funding and
startup-program opportunities (cloud/GPU credits, accelerators from big tech). Project profile:

${profile}
${cfg.rules}

You have a web search tool. Find CURRENTLY OPEN funding calls (open calls, grants, RFPs, startup
programs and credits) this project could realistically apply to. Today is ${today()}.

For each relevant, currently open call output a JSON object with exactly these fields:
- "type": "grant" or "startup_program"
- "name", "link" (direct URL), "deadline" (date, "rolling" or "unknown"), "sum" (range/max or "unknown"),
  "period" (e.g. "12 months" or "unknown")
- "open_source_required": "yes" | "no" | "unclear"
- "scientific_articles_required": "yes" | "no" | "unclear"
- "consortium_required": "yes" if multiple partner organisations are structurally required, "no" if a small
  team can apply alone, "unclear" otherwise
- "documents_required": short list of documents (or ["unknown"])
- "relevance_note": one sentence on why it fits (mention if a lead/partner organisation would be needed)

RULES: for "startup_program" keep it short (use "n/a" for period/articles/documents unless stated; put credit
amount in "sum" and eligibility in relevance_note). Only include calls CURRENTLY accepting applications.

${JSON_ONLY}`;
  },
  sourcePrompt(s) {
    const hint = {
      solo: 'This source is generally solo/small-team applicable.',
      consortium: 'This source generally REQUIRES a multi-organisation consortium - flag consortium_required accordingly unless a specific call says otherwise.',
      either: 'This source has a mix of solo and consortium tracks - judge consortium_required per call.',
    }[s.applicant_type || 'either'];
    return `Check this funding source for currently open calls relevant to our project profile:

Source name: ${s.name}
URL to check: ${s.check_url}
Notes: ${s.notes || ''}
Applicant type hint: ${hint}

Search the web (including that URL and related pages on the same site). Follow the output format exactly.`;
  },
  queriesPrompt(qs) {
    return `Search the web for new funding opportunities not tied to a specific organisation, starting from these angles:

${qs.map((x) => `- ${x}`).join('\n')}

Find open calls, grants or RFPs CURRENTLY open for applications. Follow the output format exactly.`;
  },
  accept(it) {
    if (String(it.consortium_required || '').trim().toLowerCase() === 'yes') return false;
    const text = `${it.name || ''} ${it.relevance_note || ''}`.toLowerCase();
    return !cfg.blocked.some((w) => text.includes(w)) && !!it.name;
  },
  key: (it) => `${normName(it.name)}|${normUrl(it.link)}`,
  similar: sameGrant,   // fuzzy duplicate check against rows already in the table (incl. hidden ones)
  toRecord(it, taskName) {
    const docs = Array.isArray(it.documents_required) ? it.documents_required.join(', ') : str(it.documents_required);
    return {
      name: str(it.name), source: taskName, link: str(it.link, '#'), deadline: str(it.deadline), sum: str(it.sum),
      period: str(it.period), oss: yn(it.open_source_required), articles: yn(it.scientific_articles_required),
      docs, note: str(it.relevance_note, ''), kind: str(it.type, 'grant'),
      consortium: str(it.consortium_required, 'unclear'), applied: 'No', result: '—',
    };
  },
};
