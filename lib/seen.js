// Imports the old Telegram bot's history (funds/seen-data.js) into the grants table. Idempotent:
// rows already present (same normalised name|link key) are not duplicated; the bot's "applied"/"hidden"
// status is carried over (and only ever upgrades an existing row, never downgrades it).
import { q } from './db.js';
import funds from '../funds/index.js';
import SEEN from '../funds/seen-data.js';
import { sameGrant } from './dedupe.js';

export async function importSeen() {
  const existing = new Map((await q(`SELECT id, key, data FROM records WHERE kind='grants'`)).map((r) => [r.key, r]));
  let added = 0, updated = 0;
  for (const e of SEEN) {
    if (!e.name) continue;
    const key = funds.key({ name: e.name, link: e.link });
    const applied = e.status === 'applied', hidden = e.status === 'hidden';
    // exact key, or a fuzzy near-duplicate of a row already in the table: carry the bot's status over instead of adding a copy
    const cur = existing.get(key) || [...existing.values()].find((r) => sameGrant({ name: e.name, link: e.link }, r.data));
    if (cur) {
      const patch = {};
      if (applied && cur.data.applied !== 'Yes') { patch.applied = 'Yes'; if (!cur.data.result || cur.data.result === '—') patch.result = 'Pending'; }
      if (hidden && !cur.data.hidden) { patch.hidden = true; patch.isNew = false; }
      if (Object.keys(patch).length) { await q(`UPDATE records SET data = data || $2::jsonb, updated_at = now() WHERE id=$1`, [cur.id, JSON.stringify(patch)]); updated++; }
      continue;
    }
    const data = {
      name: e.name, source: e.source || 'bot', link: e.link || '#', deadline: 'unknown', sum: 'unknown', period: 'unknown', oss: '?', articles: '?',
      docs: 'To check', note: 'Imported from the Telegram bot history.', kind: 'grant', consortium: 'unclear',
      applied: applied ? 'Yes' : 'No', result: applied ? 'Pending' : '—', hidden, isNew: false, found: 'bot', firstSeen: e.first_seen || '',
    };
    await q('INSERT INTO records (id, kind, key, data) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING', ['bot_' + (e.id || key), 'grants', key, JSON.stringify(data)]);
    existing.set(key, { id: 'bot_' + (e.id || key), data });
    added++;
  }
  return { added, updated, total: SEEN.length };
}
