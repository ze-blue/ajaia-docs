'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { SESSION_COOKIE, encodeSession } from '@/lib/session';

export async function login(formData: FormData) {
  const id = String(formData.get('uid') ?? '');
  const [user] = await q('select id from users where id = $1', [id]);
  if (!user) redirect('/login?error=unknown-user');
  (await cookies()).set(SESSION_COOKIE, encodeSession(id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
