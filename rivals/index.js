// Rivals analysis: competing / adjacent historical-map products. Existing rows are REFRESHED
// (what's new, last checked) instead of skipped, so the table keeps tracking changes.
import { today, str, normName, HISTORICA, JSON_ONLY } from '../_lib/shared.js';
export default {
  id: 'rivals',
  title: 'Rivals analysis',
  collection: 'rivals',
  description: 'Competing historical-map and timeline products: their market, what they shipped recently, and what Historica can learn from them. Existing rivals are refreshed, new ones are added.',
  profile: HISTORICA,
  sources: [
    { name: 'Geacron', check_url: 'https://geacron.com/', notes: 'World atlas 3000 BC to today; freemium; check new features, apps, export.' },
    { name: 'Chronas', check_url: 'https://chronas.org/', notes: 'Wikipedia-linked community-edited map; check news, editing features.' },
    { name: 'OpenHistoricalMap', check_url: 'https://www.openhistoricalmap.org/', notes: 'Open editable map with time slider; check blog/news.' },
    { name: 'OldMapsOnline', check_url: 'https://www.oldmapsonline.org/', notes: 'Scanned old maps search with timeline; apps, new collections.' },
    { name: 'David Rumsey Map Collection', check_url: 'https://www.davidrumsey.com/', notes: 'Large scanned map archive; new tools (georeferencer, Luna).' },
    { name: 'Panchronia', check_url: '', notes: 'Globe with borders by year, daily game, quizzes (RU/EN). Find its current site with web search.' },
    { name: 'World History Maps (iOS)', check_url: 'https://apps.apple.com/us/app/id1013483861', notes: 'Paid iOS atlas, a map for every year; check version history.' },
    { name: 'HistoricalAtlas (iOS)', check_url: 'https://apps.apple.com/app/id1609910044', notes: '3000 BC to 1900 AD iOS atlas; check version history.' },
    { name: 'TimeMap.org', check_url: 'http://www.timemap.org/', notes: 'World map 4000 BCE to 2010 with region/ruler tabs.' },
    { name: 'Pelagios / Recogito', check_url: 'https://recogito.pelagios.org/', notes: 'Research tools linking sources to places; scholar-facing.' },
  ],
  queries: [
    'new interactive historical map website launched 2026 borders by year',
    'AI-generated historical maps tool for historians and teachers 2026',
    'historical atlas app time slider new release 2026',
    'digital history map platform for researchers open data export GeoJSON',
  ],
  system(profile) {
    return `You are a competitive-intelligence analyst for a small open project.
Our project:

${profile}

Our known strengths: very long time range (4000 BCE to today), monthly time steps in modern eras, five switchable layers (countries, regions, cities, tribes, events), event search, AI/algorithmic border generation, a Map Builder (closed beta) where researchers edit sources and borders follow.
Our known weaknesses: no native mobile app, closed contribution route, no daily habit feature, no public sources/confidence page, no proven accuracy benchmark.

You have a web search tool. Today is ${today()}. Find competing or adjacent products: interactive historical maps, historical atlases, timelines, scanned-map archives, historical GIS and map-making tools for researchers and teachers.

For each product output a JSON object with exactly these fields:
- "name": product name
- "link": official URL (https://...), verified by search; never invent one
- "market": who it is for and where (audience, languages, platforms, price model) in one short sentence
- "what_new": what changed or launched recently (last ~12 months) with the year/month if known; "nothing found" if none
- "what_we_can_take": one concrete idea Historica could adopt, or "nothing" if none
- "historica_better": one short phrase on where Historica is ahead of this product, or ""
- "historica_worse": one short phrase on where Historica is behind it, or ""

Be factual: if you cannot verify something, say "unverified" instead of guessing.

${JSON_ONLY}`;
  },
  sourcePrompt(s) {
    return `Research this specific rival and report its current state:

Product: ${s.name}
${s.check_url ? 'URL to check: ' + s.check_url : 'Find its official website first.'}
Notes: ${s.notes || ''}

Search the web (site, blog/news, app-store version history). Return ONE object in the array. Follow the output format exactly.`;
  },
  queriesPrompt(qs) {
    return `Search the web for NEW or lesser-known rivals using these angles:

${qs.map((x) => `- ${x}`).join('\n')}

Return up to 6 products that Historica should track, excluding Geacron, Chronas, OpenHistoricalMap, OldMapsOnline, David Rumsey, Panchronia, World History Maps, HistoricalAtlas, TimeMap.org, Pelagios. Follow the output format exactly.`;
  },
  accept(it) { return !!it.name && /^https?:\/\//i.test(String(it.link || '')); },
  key: (it) => normName(it.name),
  toRecord(it, taskName) {
    return {
      name: str(it.name), link: str(it.link, '#'), market: str(it.market, ''), whatNew: str(it.what_new, ''),
      take: str(it.what_we_can_take, ''), better: str(it.historica_better, ''), worse: str(it.historica_worse, ''),
      lastChecked: today(), source: taskName,
    };
  },
  /** Patch applied to an EXISTING row when the service finds it again (keeps the user's other edits). */
  refresh(it) {
    const p = { lastChecked: today() };
    const n = str(it.what_new, '');
    if (n && !/^nothing found$/i.test(n)) p.whatNew = n;
    return p;
  },
};
