import Link from 'next/link';
import { HomeActions } from '@/components/HomeActions';
import { requirePageUser } from '@/lib/auth';
import { type DocSummary, listDocuments } from '@/lib/documents';
import { logout } from './actions';

function DocList({ docs, empty, shared }: { docs: DocSummary[]; empty: string; shared?: boolean }) {
  if (docs.length === 0) return <p className="py-6 text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {docs.map((d) => (
        <li key={d.id}>
          <Link href={`/docs/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <span className="font-medium">{d.title}</span>
            <span className="flex items-center gap-3 text-xs text-gray-500">
              {shared && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                  {d.owner_name} · {d.role}
                </span>
              )}
              <time dateTime={new Date(d.updated_at).toISOString()}>
                {new Date(d.updated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function Home() {
  const user = await requirePageUser();
  const { owned, shared } = await listDocuments(user);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ajaia Docs</h1>
        <form action={logout} className="text-sm text-gray-600">
          Signed in as <strong>{user.name}</strong> ·{' '}
          <button className="text-blue-700 hover:underline">Switch user</button>
        </form>
      </header>

      <HomeActions />

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">My documents</h2>
        <DocList docs={owned} empty="No documents yet. Create one or import a file." />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Shared with me</h2>
        <DocList docs={shared} shared empty="Nothing shared with you yet." />
      </section>
    </main>
  );
}
