import { Avatar } from '@/components/Avatar';
import { DocumentBrowser } from '@/components/DocumentBrowser';
import { HomeActions } from '@/components/HomeActions';
import { Logo } from '@/components/Logo';
import { requirePageUser } from '@/lib/auth';
import { listDocuments } from '@/lib/documents';
import { logout } from './actions';

export default async function Home() {
  const user = await requirePageUser();
  const { owned, shared } = await listDocuments(user);

  return (
    <div className="min-h-screen w-full">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Logo />
          <form action={logout} className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium leading-tight">{user.name}</span>
              <span className="block text-xs text-gray-600">{user.email}</span>
            </span>
            <Avatar id={user.id} name={user.name} />
            <button className="rounded-md px-2 py-1 text-sm text-blue-700 hover:bg-blue-50">Switch user</button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="mt-1 text-sm text-gray-600">Your documents and the ones shared with you.</p>
          </div>
        </div>
        <HomeActions />
        <DocumentBrowser owned={owned} shared={shared} me={user.name} />
      </main>
    </div>
  );
}
