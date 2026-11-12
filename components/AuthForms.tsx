'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { type FormState, signIn, signUp } from '@/app/actions';

function Field({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} name={id} className="field mt-1.5" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field id="email" label="Email" type="email" autoComplete="email" required defaultValue={state.email} />
      <Field id="password" label="Password" type="password" autoComplete="current-password" required />
      <button disabled={pending} className="btn btn-primary w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-muted">
        New here?{' '}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field id="name" label="Name" autoComplete="name" required maxLength={80} defaultValue={state.name} />
      <Field id="email" label="Email" type="email" autoComplete="email" required defaultValue={state.email} />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
      />
      <button disabled={pending} className="btn btn-primary w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
