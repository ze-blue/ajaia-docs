'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { authenticate, createAccount } from '@/lib/accounts';
import { AppError } from '@/lib/errors';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, encodeSession } from '@/lib/session';

/** One-click sign-in is limited to these seeded demo accounts, never real ones. */
const DEMO_USER_IDS = new Set(['u_alice', 'u_bob', 'u_carol']);

export type FormState = { error?: string; email?: string; name?: string };

async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '');
  const user = await authenticate({ email, password: formData.get('password') });
  if (!user) return { error: 'That email and password don’t match an account.', email };
  await startSession(user.id);
  redirect('/');
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');
  try {
    const user = await createAccount({ name, email, password: formData.get('password') });
    await startSession(user.id);
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? 'Check the form and try again.', name, email };
    if (e instanceof AppError) return { error: e.message, name, email };
    throw e;
  }
  redirect('/');
}

export async function demoSignIn(formData: FormData) {
  const id = String(formData.get('uid') ?? '');
  if (!DEMO_USER_IDS.has(id)) redirect('/login');
  await startSession(id);
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
