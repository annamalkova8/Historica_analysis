// Helpers and prompt fragments shared by all search services.

export const today = () => new Date().toISOString().slice(0, 10);
/** true when a free-text deadline is a real date (ISO, or text with a 4-digit year) that is before today; rolling/unknown/none -> false */
export const deadlinePassed = (t) => {
  const v = String(t || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v < today();
  if (!/\b(19|20)\d{2}\b/.test(v)) return false;
  const ms = Date.parse(v);
  return !isNaN(ms) && new Date(ms).toISOString().slice(0, 10) < today();
};
export const str = (v, d = 'unknown') => (v === undefined || v === null || String(v).trim() === '' ? d : String(v).trim());
export const yn = (v) => ({ yes: 'Yes', no: 'No' }[String(v).toLowerCase()] || '?');
export const normUrl = (u) =>
  String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
export const normName = (n) => String(n || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const money = (t) => {
  const m = String(t || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(+m[1]) : 0;
};

export const HISTORICA = `Project name: Historica
What it does: interactive historical maps (explore borders, regions and changes year by year) built from
historical documents using LLM-assisted extraction, plus "Map Builder" - a beta tool that lets teachers
and researchers create and publish their own historical maps. Open maps are updated constantly.
Main goal: the highest-quality, most convenient historical maps for scientists, then to become the most
popular instrument among scientists and history educators.
Team: small self-funded team of 3 people, not yet incorporated.`;

export const JSON_ONLY = `Respond with ONLY a JSON array of these objects, nothing else - no markdown fences, no preamble.
If you find nothing relevant, respond with exactly: []
Do not invent or guess facts, dates, prices or links. If genuinely unknown, write "unknown".`;

