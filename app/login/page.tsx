import { Avatar } from '@/components/Avatar';
import { LogoMark } from '@/components/Logo';
import type { User } from '@/lib/auth';
import { q } from '@/lib/db';
import { login } from '../actions';

export default async function LoginPage() {
  const users = await q<User>('select id, name, email from users order by name');
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Ajaia Docs</h1>
          <p className="mt-1 text-sm text-gray-600">Write, share and edit documents together.</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-sm font-medium text-gray-900">Choose a demo account</h2>
          <p className="mt-1 text-xs text-gray-600">
            No password needed. Use two browser windows with different accounts to try sharing and live updates.
          </p>
          <form action={login} className="mt-4 space-y-2">
            {users.map((u) => (
              <button
                key={u.id}
                name="uid"
                value={u.id}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                <Avatar id={u.id} name={u.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-gray-600">{u.email}</span>
                </span>
                <span aria-hidden className="text-gray-400">
                  →
                </span>
              </button>
            ))}
          </form>
        </div>
      </div>
    </main>
  );
}
