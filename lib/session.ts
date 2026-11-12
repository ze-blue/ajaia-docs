import { createHmac, timingSafeEqual } from 'node:crypto';

// The session cookie holds `<userId>.<issuedAt>.<HMAC signature>`. The signature stops anyone
// from editing the cookie to become another user; issuedAt lets the server expire sessions
// itself instead of trusting the browser to drop the cookie.

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production.');
  }
  return 'dev-only-insecure-secret';
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function encodeSession(userId: string, now = Date.now()): string {
  const payload = `${userId}.${Math.floor(now / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const sigDot = token.lastIndexOf('.');
  if (sigDot <= 0) return null;
  const payload = token.slice(0, sigDot);
  const given = Buffer.from(token.slice(sigDot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const iatDot = payload.lastIndexOf('.');
  if (iatDot <= 0) return null;
  const issuedAt = Number(payload.slice(iatDot + 1));
  if (!Number.isInteger(issuedAt)) return null;
  const age = now / 1000 - issuedAt;
  if (age < -60 || age > SESSION_MAX_AGE_SECONDS) return null; // expired, or issued in the future
  return payload.slice(0, iatDot);
}
