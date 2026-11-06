import { passwordOk, cookieHeader } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.APP_PASSWORD) return res.status(500).json({ error: 'APP_PASSWORD is not configured on the server' });
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  if (!passwordOk(body.password)) return res.status(401).json({ error: 'wrong password' });
  res.setHeader('Set-Cookie', cookieHeader());
  return res.status(200).json({ ok: true });
}
const safeJson = (s) => { try { return JSON.parse(s); } catch { return {}; } };
