import type { User } from '@/lib/auth';
import { q } from '@/lib/db';
import { login } from '../actions';

export default async function LoginPage() {
  const users = await q<User>('select id, name, email from users order by name');
  return (
    <main className="mx-auto mt-24 w-full max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Ajaia Docs</h1>
      <p className="mt-2 text-sm text-gray-600">
        Demo sign-in: pick a seeded user (no password). Sign in as different users to try sharing.
      </p>
      <form action={login} className="mt-6 space-y-2">
        {users.map((u) => (
          <button
            key={u.id}
            name="uid"
            value={u.id}
            className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="font-medium">{u.name}</span>
            <span className="block text-sm text-gray-500">{u.email}</span>
          </button>
        ))}
      </form>
    </main>
  );
}
