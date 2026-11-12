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
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Logo />
          <form action={logout} className="flex min-w-0 items-center gap-2">
            <Avatar id={user.id} name={user.name} />
            <span className="hidden truncate text-sm font-medium sm:block">{user.name}</span>
            <button className="btn btn-quiet">Sign out</button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <HomeActions />
        <DocumentBrowser owned={owned} shared={shared} me={user.name} />
      </main>
    </div>
  );
}
