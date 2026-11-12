import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';
import { SESSION_MAX_AGE_SECONDS, decodeSession, encodeSession } from '@/lib/session';

describe('signed session cookie', () => {
  it('round-trips a user id', () => {
    expect(decodeSession(encodeSession('u_alice'))).toBe('u_alice');
  });
  it('rejects a cookie whose user id was tampered with', () => {
    const token = encodeSession('u_alice');
    expect(decodeSession(token.replace('u_alice', 'u_bob'))).toBeNull();
  });
  it('rejects a cookie whose issued-at time was tampered with', () => {
    const token = encodeSession('u_alice', Date.parse('2020-01-01'));
    const [id, , sig] = token.split('.');
    expect(decodeSession(`${id}.${Math.floor(Date.now() / 1000)}.${sig}`)).toBeNull();
  });
  it('expires after the maximum session age', () => {
    const issued = Date.parse('2026-11-01T00:00:00Z');
    const token = encodeSession('u_alice', issued);
    expect(decodeSession(token, issued + (SESSION_MAX_AGE_SECONDS - 60) * 1000)).toBe('u_alice');
    expect(decodeSession(token, issued + (SESSION_MAX_AGE_SECONDS + 60) * 1000)).toBeNull();
  });
  it('rejects garbage, old-format and missing cookies', () => {
    expect(decodeSession('u_bob')).toBeNull();
    expect(decodeSession('u_bob.abc')).toBeNull();
    expect(decodeSession('')).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^scrypt\$/);
    expect(stored).not.toContain('correct');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false);
  });
  it('salts each hash, so equal passwords store differently', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });
  it('rejects missing or malformed stored hashes', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
  });
});
