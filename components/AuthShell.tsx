import { LogoMark } from './Logo';

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-xl font-semibold tracking-tight">Ajaia Docs</span>
        </div>
        <div className="surface p-5 sm:p-6">
          <h1 className="mb-4 text-lg font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
