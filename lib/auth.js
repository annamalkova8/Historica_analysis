import crypto from 'node:crypto';

const COOKIE = 'hub_session';
const secret = () => process.env.SESSION_SECRET || process.env.APP_PASSWORD || '';
export const sessionToken = () =>
  crypto.createHmac('sha256', secret()).update('historica-hub-session-v1').digest('hex');

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function passwordOk(pw) {
  return !!process.env.APP_PASSWORD && safeEq(pw ?? '', process.env.APP_PASSWORD);
}

export function cookieHeader() {
  return `${COOKIE}=${sessionToken()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;
}

function readCookie(req) {
  const raw = req.headers?.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return '';
}

export function isCron(req) {
  const s = process.env.CRON_SECRET;
  return !!s && safeEq(req.headers?.authorization || '', `Bearer ${s}`);
}

/** Returns true if the request may proceed; otherwise writes the error response. */
export function requireAuth(req, res) {
  if (!process.env.APP_PASSWORD) {
    res.status(500).json({ error: 'APP_PASSWORD is not configured on the server' });
    return false;
  }
  if (!safeEq(readCookie(req), sessionToken())) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
