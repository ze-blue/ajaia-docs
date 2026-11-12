import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Password hashing with scrypt (memory-hard, built into Node, no native dependency).
// Stored format: scrypt$<salt base64url>$<hash base64url>

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [algo, saltB64, hashB64] = (stored ?? '').split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64url'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Used when the email is unknown, so a failed sign-in takes the same time either way. */
export const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);
