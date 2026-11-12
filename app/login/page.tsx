import { AuthShell } from '@/components/AuthShell';
import { SignInForm } from '@/components/AuthForms';
import { Avatar } from '@/components/Avatar';
import type { User } from '@/lib/auth';
import { q } from '@/lib/db';
import { demoSignIn } from '../actions';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

const DEMO_IDS = ['u_alice', 'u_bob', 'u_carol'];

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  const demoUsers = await q<User>('select id, name, email from users where id = any($1) order by name', [DEMO_IDS]);
  return (
    <AuthShell title="Sign in">
      <SignInForm />

      <div className="mt-6 border-t border-line pt-5">
        <h2 className="text-sm font-medium">Reviewing? Use a demo account</h2>
        <p className="mt-1 text-xs text-muted">
          One click, or sign in above with password <span className="font-mono text-ink">demo-password</span>. Use a
          private window for a second person to try sharing.
        </p>
        <form action={demoSignIn} className="mt-3 grid gap-2 sm:grid-cols-3">
          {demoUsers.map((u) => (
            <button
              key={u.id}
              name="uid"
              value={u.id}
              aria-label={`Continue as ${u.name}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-sm transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <Avatar id={u.id} name={u.name} size="sm" />
              <span className="truncate font-medium">{u.name.split(' ')[0]}</span>
            </button>
          ))}
        </form>
      </div>
    </AuthShell>
  );
}
