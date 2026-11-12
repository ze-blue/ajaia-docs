import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q } from './db';
import { AppError } from './errors';
import { SESSION_COOKIE, decodeSession } from './session';

export type User = { id: string; name: string; email: string };

export async function currentUser(): Promise<User | null> {
  const userId = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const [user] = await q<User>('select id, name, email from users where id = $1', [userId]);
  return user ?? null;
}

/** For pages: send anonymous visitors to the login screen. */
export async function requirePageUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

/** For API routes: anonymous requests get a 401. */
export async function requireApiUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AppError(401, 'Please sign in.');
  return user;
}
