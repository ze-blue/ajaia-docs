import { Avatar } from '@/components/Avatar';
import { LogoMark } from '@/components/Logo';
import type { User } from '@/lib/auth';
import { q } from '@/lib/db';
import { login } from '../actions';

export default async function LoginPage() {
  const users = await q<User>('select id, name, email from users order by name');
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="size-9" />
          <h1 className="text-xl font-semibold tracking-tight">Ajaia Docs</h1>
        </div>

        <div className="surface p-5 sm:p-6">
          <h2 className="font-semibold">Sign in as</h2>
          <form action={login} className="mt-3 space-y-2">
            {users.map((u) => (
              <button
                key={u.id}
                name="uid"
                value={u.id}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <Avatar id={u.id} name={u.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted">{u.email}</span>
                </span>
              </button>
            ))}
          </form>
          <p className="mt-4 text-xs text-muted">
            Demo accounts, no password. To try sharing, sign in as a second person in a private window.
          </p>
        </div>
      </div>
    </main>
  );
}
