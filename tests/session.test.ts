import { describe, expect, it } from 'vitest';
import { decodeSession, encodeSession } from '@/lib/session';

describe('signed session cookie', () => {
  it('round-trips a user id', () => {
    expect(decodeSession(encodeSession('u_alice'))).toBe('u_alice');
  });
  it('rejects a cookie whose user id was tampered with', () => {
    const token = encodeSession('u_alice');
    expect(decodeSession(token.replace('u_alice', 'u_bob'))).toBeNull();
  });
  it('rejects garbage and missing cookies', () => {
    expect(decodeSession('u_bob')).toBeNull();
    expect(decodeSession('')).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});
