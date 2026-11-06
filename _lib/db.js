import { neon } from '@neondatabase/serverless';

let impl = null; // tests can inject a driver with setDb({ query })

export function setDb(d) { impl = d; ready_ = null; }

function client() {
  if (!impl) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not set (add Neon Postgres in the Vercel Storage tab)');
    impl = neon(url);
  }
  return impl;
}

let ready_ = null;
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS records (
     id text PRIMARY KEY,
     kind text NOT NULL,
     key text,
     data jsonb NOT NULL DEFAULT '{}',
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS records_kind_idx ON records (kind, created_at)`,
  `CREATE INDEX IF NOT EXISTS records_key_idx ON records (kind, key)`,
  `CREATE TABLE IF NOT EXISTS settings (
     key text PRIMARY KEY,
     value jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS runs (
     id bigserial PRIMARY KEY,
     service text NOT NULL,
     task text,
     trigger text,
     started_at timestamptz NOT NULL DEFAULT now(),
     finished_at timestamptz,
     found int NOT NULL DEFAULT 0,
     added int NOT NULL DEFAULT 0,
     error text
   )`,
];

/** Run a parameterised query. Always call ready() first in API handlers. */
export const q = (text, params = []) => client().query(text, params);

export function ready() {
  if (!ready_) ready_ = (async () => { for (const s of SCHEMA) await q(s); })().catch((e) => { ready_ = null; throw e; });
  return ready_;
}

export async function getSetting(key, fallback = null) {
  const r = await q('SELECT value FROM settings WHERE key=$1', [key]);
  return r.length ? r[0].value : fallback;
}
export async function setSetting(key, value) {
  await q(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
