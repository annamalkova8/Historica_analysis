// Community search: active communities of history teachers, digital humanists and map enthusiasts.
import { today, str, yn, normUrl, normName, money, HISTORICA, JSON_ONLY } from '../lib/shared.js';
import { sameComm } from '../lib/dedupe.js';
export default {
  id: 'communities',
  title: 'Community search',
  collection: 'comms',
  description: 'Active online communities of history teachers, digital humanists and map enthusiasts where Historica can find users, testers and partners.',
  profile: `${HISTORICA}
Outreach goals: (1) Acquisition - invite people to explore the maps; (2) Feedback - recruit testers (present Map Builder
as a beta, not a launched product); (3) Partnership - teachers and researchers who could use Historica in teaching.
Target audiences: history teachers, university departments, digital humanities researchers, historical geography
enthusiasts, historical map communities. Prefer small, active, relevant communities over the largest ones.`,
  sources: [
    { name: 'H-Net networks', check_url: 'https://networks.h-net.org/', notes: 'Scholarly networks; find ones on historical cartography, digital history, teaching.' },
    { name: 'EuroClio hubs', check_url: 'https://euroclio.eu/euroclio-hubs/', notes: 'National/regional history educator associations in Europe.' },
    { name: 'AHA Communities', check_url: 'https://communities.historians.org/', notes: 'Teaching and digital history communities.' },
    { name: 'ADHO and DH associations', check_url: 'https://adho.org/', notes: 'Constituent organisations and special interest groups; mailing lists.' },
    { name: 'Reddit communities', check_url: 'https://www.reddit.com/subreddits/', notes: 'Active subreddits for history teaching, historical maps, geography, digital humanities. Note self-promotion rules.' },
    { name: 'NCHE and US history educator networks', check_url: 'https://ncheteach.org/', notes: 'History educator communities, Discord and mailing lists.' },
    { name: 'Humanist and DH mailing lists', check_url: 'https://dhhumanist.org/', notes: 'Open digital humanities lists that accept project announcements.' },
    { name: 'Geovistory and linked-open-data history communities', check_url: 'https://www.geovistory.org/community', notes: 'Digital historians and developers working on historical data.' },
  ],
  queries: [
    'active Discord servers for history teachers and educators',
    'Facebook groups LinkedIn groups historical maps and historical geography',
    'digital humanities mailing lists that accept project announcements',
    'forums for historical cartography and map enthusiasts',
    'history teacher associations Europe online community resources sharing',
  ],
  system(profile) {
    return `You are a research assistant helping a small project find online communities for outreach.
Project profile:

${profile}

You have a web search tool. Find ACTIVE communities (forums, subreddits, Discord/Slack servers, mailing lists,
association networks, social groups) relevant to the profile. Today is ${today()}.

For each community output a JSON object with exactly these fields:
- "name": community name
- "platform": "Reddit" | "Discord" | "Slack" | "Mailing list" | "Forum" | "Facebook group" | "LinkedIn group" | "Association network" | "Other"
- "audience": who is in it
- "url": direct URL to the community or its join page
- "size_activity": member count / activity level if stated, else "unknown"
- "rules": posting and self-promotion rules if you can find them, else "unknown - check before posting"
- "goal": "Acquisition" | "Feedback" | "Partnership" (best fit)
- "priority": "Very high" | "High" | "Medium"
- "best_approach": one sentence on how to engage (value first, not repeated promotion)
- "relevance_note": one sentence on why it fits

Only include communities that appear active and open to newcomers. Skip dead or private-only ones.

${JSON_ONLY}`;
  },
  sourcePrompt(s) {
    return `Look at this directory or network and find individual communities that fit our profile:

Directory: ${s.name}
URL: ${s.check_url}
Notes: ${s.notes || ''}

Search the web, including that URL. Follow the output format exactly.`;
  },
  queriesPrompt(qs) {
    return `Search the web for relevant online communities using these angles:

${qs.map((x) => `- ${x}`).join('\n')}

Follow the output format exactly.`;
  },
  accept: (it) => !!it.name && !!it.url,
  key: (it) => normUrl(it.url) || normName(it.name),
  similar: sameComm,
  toRecord(it, taskName) {
    const pr = ['Very high', 'High', 'Medium'].includes(it.priority) ? it.priority : 'Medium';
    const goal = ['Acquisition', 'Feedback', 'Partnership'].includes(it.goal) ? it.goal : 'Acquisition';
    return {
      name: str(it.name), platform: str(it.platform, ''), audience: str(it.audience, ''), url: str(it.url, '#'),
      priority: pr, approach: str(it.best_approach, ''), goal, rules: str(it.rules, ''), size: str(it.size_activity, ''),
      note: str(it.relevance_note, ''), source: taskName, contact: '', date: '', status: 'Not started',
      responses: 0, visits: 0, testers: 0,
    };
  },
};
