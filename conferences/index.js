// Conference search: upcoming conferences and calls for papers.
import { today, deadlinePassed, str, yn, normUrl, normName, money, HISTORICA, JSON_ONLY } from '../_lib/shared.js';
import { sameConf } from '../_lib/dedupe.js';
export default {
  id: 'conferences',
  title: 'Conference search',
  collection: 'confs',
  description: 'Upcoming conferences where Historica could present or find users: digital humanities, historical GIS, open geospatial, history education.',
  profile: HISTORICA,
  sources: [
    { name: 'ADHO Digital Humanities conference', check_url: 'https://adho.org/conference/', notes: 'Annual international DH conference; check next edition and call for papers.' },
    { name: 'DH Benelux', check_url: 'https://dhbenelux.org/', notes: 'Regional DH conference; digital history and humanities.' },
    { name: 'FOSS4G (global and regional)', check_url: 'https://foss4g.org/', notes: 'Open-source geospatial; global, Europe and regional editions.' },
    { name: 'State of the Map (global and regional)', check_url: 'https://stateofthemap.org/', notes: 'OpenStreetMap community conferences.' },
    { name: 'EuroClio annual conference', check_url: 'https://euroclio.eu/', notes: 'European history educators - teaching with maps and digital tools.' },
    { name: 'AHA annual meeting', check_url: 'https://www.historians.org/annual-meeting/', notes: 'American Historical Association; teaching and digital history sessions.' },
    { name: 'H-Net CFP listings', check_url: 'https://www.h-net.org/cfp/', notes: 'Calls for papers across history; filter for digital history, historical GIS, cartography, teaching.' },
    { name: 'ICA (International Cartographic Association) conferences', check_url: 'https://icaci.org/', notes: 'Cartography and GIScience; history of cartography commissions.' },
    { name: 'Wikimania', check_url: 'https://wikimania.wikimedia.org/', notes: 'Open knowledge community, relevant to open maps and data.' },
    { name: 'FOSDEM', check_url: 'https://fosdem.org/', notes: 'Free software; look for geospatial / maps devrooms and CFP dates.' },
  ],
  queries: [
    'call for papers 2027 digital humanities historical GIS conference',
    'call for proposals 2027 history education conference digital tools maps',
    'conference 2027 open geospatial cartography historical maps',
    'conference 2027 digital history spatial humanities workshop CFP',
    'open source and open data conference 2027 call for talks cultural heritage',
  ],
  system(profile) {
    return `You are a research assistant helping a small project find conferences to present at or attend.
Project profile:

${profile}

You have a web search tool. Find UPCOMING conferences (starting after ${today()} and within the next 18 months)
relevant to the project: digital humanities, digital/spatial history, historical GIS and cartography,
open-source geospatial, open data / cultural heritage, history and geography education.

For each conference output a JSON object with exactly these fields:
- "name": official conference name including year/edition
- "link": direct URL to the conference or its call for papers page
- "start_date": start date as YYYY-MM-DD if known (else the best text, e.g. "June 2027")
- "location": city and country, or "online"
- "country": country name only in English (e.g. "Germany", "United States"), or "Online"
- "format": "in-person" | "online" | "hybrid" | "unknown"
- "cfp_deadline": submission/proposal deadline as YYYY-MM-DD, "none" if no call for papers, or "unknown"
- "cost": registration fee as stated (e.g. "EUR 350", "free") or "unknown"
- "topics": short comma-separated topics
- "relevance_note": one sentence on why Historica should care, and what kind of submission fits (talk, poster, demo, workshop)

Skip conferences that already took place, ones whose submission deadline is before ${today()}, and ones unrelated to the topics above.

${JSON_ONLY}`;
  },
  sourcePrompt(s) {
    return `Check this conference series for its next upcoming edition(s):

Series: ${s.name}
URL to check: ${s.check_url}
Notes: ${s.notes || ''}

Search the web, including that URL and the latest edition pages. Follow the output format exactly.`;
  },
  queriesPrompt(qs) {
    return `Search the web for upcoming conferences and calls for papers using these angles:

${qs.map((x) => `- ${x}`).join('\n')}

Find conferences that fit the profile. Follow the output format exactly.`;
  },
  accept(it) {
    if (!it.name) return false;
    const d = String(it.start_date || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < today()) return false;
    if (deadlinePassed(it.cfp_deadline)) return false;   // submission deadline already passed
    return true;
  },
  key: (it) => normName(it.name),
  similar: sameConf,
  toRecord(it, taskName) {
    return {
      name: str(it.name), focus: str(it.topics, ''), date: str(it.start_date), loc: str(it.location), country: str(it.country, ''),
      format: str(it.format), deadline: str(it.cfp_deadline), costText: str(it.cost), cost: money(it.cost),
      link: str(it.link, '#'), note: str(it.relevance_note, ''), source: taskName, applied: 'No', result: '—',
    };
  },
};
