// Registry of search services. Each service lives in its own top-level folder.
// To add one (e.g. social): create <folder>/index.js with the same shape and register it here.
import funds from '../funds/index.js';
import conferences from '../conferences/index.js';
import communities from '../communities/index.js';
import rivals from '../rivals/index.js';
import { normName, normUrl } from './shared.js';

// id = key used by the API/UI. Folder names: funds/ conferences/ communities/ (social_analysis/ is reserved for the social service).
export const SERVICES = { grants: funds, conferences, communities, rivals };
// Collections the browser may write (diff-sync). 'jira' rows are written only by the Jira sync and are read-only for the UI.
export const SYNCABLE = ['grants', 'confs', 'comms', 'unis', 'testers', 'tplList', 'funnels', 'rivals', 'rivalDirs', 'mapq', 'mapqIn', 'followers', 'roadmap'];
export const COLLECTIONS = [...SYNCABLE, 'jira'];

/** Key used for de-duplication, computed from a stored record (so manual entries dedupe too). */
export function keyForRecord(kind, d) {
  if (kind === 'grants') return funds.key({ name: d.name, link: d.link });
  if (kind === 'confs') return conferences.key({ name: d.name });
  if (kind === 'comms') return communities.key({ url: d.url, name: d.name });
  if (kind === 'rivals') return rivals.key({ name: d.name });
  return null;
}
