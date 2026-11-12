import { randomBytes } from 'node:crypto';
import type { User } from './auth';
import { q } from './db';
import { AppError } from './errors';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';
import { signInSchema, signUpSchema } from './validation';

/** Creates an account. Throws AppError(400) for invalid input, AppError(409) if the email is taken. */
export async function createAccount(input: { name: unknown; email: unknown; password: unknown }): Promise<User> {
  const { name, email, password } = signUpSchema.parse(input);
  const id = `u_${randomBytes(9).toString('base64url')}`;
  const passwordHash = await hashPassword(password);
  const rows = await q<User>(
    `insert into users (id, name, email, password_hash) values ($1, $2, $3, $4)
     on conflict do nothing
     returning id, name, email`,
    [id, name, email, passwordHash],
  );
  if (rows.length === 0) throw new AppError(409, 'An account with that email already exists. Sign in instead.');
  return rows[0];
}

/**
 * Checks an email and password. Returns the user, or null for any failure, so the caller
 * can show one message that doesn't reveal whether the email exists.
 */
export async function authenticate(input: { email: unknown; password: unknown }): Promise<User | null> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return null;
  const [row] = await q<User & { password_hash: string | null }>(
    'select id, name, email, password_hash from users where lower(email) = lower($1)',
    [parsed.data.email],
  );
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(parsed.data.password, row?.password_hash ?? DUMMY_HASH);
  return ok && row ? { id: row.id, name: row.name, email: row.email } : null;
}
