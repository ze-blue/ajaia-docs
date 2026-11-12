'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DocSummary } from '@/lib/documents';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { RelativeTime } from './RelativeTime';

function DocRow({ d, shared, me }: { d: DocSummary; shared: boolean; me: string }) {
  return (
    <li>
      <Link href={`/docs/${d.id}`} className="block px-4 py-3 transition-colors hover:bg-gray-50 sm:px-5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{d.title}</span>
          <span className="shrink-0 text-xs text-muted">
            <RelativeTime iso={new Date(d.updated_at).toISOString()} />
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">{d.snippet || 'No content yet'}</span>
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          {shared ? (
            <>
              <Avatar id={d.owner_id} name={d.owner_name} size="sm" />
              <span className="truncate">{d.owner_name}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0 font-medium text-amber-800">{d.role === 'editor' ? 'Can edit' : 'View only'}</span>
            </>
          ) : (
            <span>{d.share_count > 0 ? `Shared with ${d.share_count}` : 'Private'}</span>
          )}
          {d.updated_by_name && d.updated_by_name !== (shared ? d.owner_name : me) && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">Last edit by {d.updated_by_name === me ? 'you' : d.updated_by_name}</span>
            </>
          )}
        </span>
      </Link>
    </li>
  );
}

function Section({
  title,
  docs,
  shared,
  empty,
  me,
}: {
  title: string;
  docs: DocSummary[];
  shared: boolean;
  empty: React.ReactNode;
  me: string;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">
        {title} <span className="font-normal text-muted">{docs.length}</span>
      </h2>
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center text-sm text-muted">{empty}</div>
      ) : (
        <ul className="surface divide-y divide-line overflow-hidden">
          {docs.map((d) => (
            <DocRow key={d.id} d={d} shared={shared} me={me} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function DocumentBrowser({ owned, shared, me }: { owned: DocSummary[]; shared: DocSummary[]; me: string }) {
  const [query, setQuery] = useState('');
  const match = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (d: DocSummary) =>
      !q || d.title.toLowerCase().includes(q) || d.snippet.toLowerCase().includes(q) || d.owner_name.toLowerCase().includes(q);
  }, [query]);
  const ownedF = owned.filter(match);
  const sharedF = shared.filter(match);
  const searching = query.trim() !== '';
  const noMatch = `Nothing matches "${query.trim()}".`;

  return (
    <>
      {owned.length + shared.length > 0 && (
        <div className="relative mt-6">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
            className="field pl-9"
          />
        </div>
      )}
      <p className="sr-only" role="status">
        {searching ? `${ownedF.length + sharedF.length} documents match` : ''}
      </p>
      <Section
        title="My documents"
        docs={ownedF}
        shared={false}
        me={me}
        empty={
          searching ? (
            noMatch
          ) : (
            <>
              <span className="block font-medium text-ink">Start your first document</span>
              <span className="mt-1 block">Create one from scratch, or import a file you already have.</span>
            </>
          )
        }
      />
      <Section
        title="Shared with me"
        docs={sharedF}
        shared
        me={me}
        empty={searching ? noMatch : 'Documents other people share with you appear here.'}
      />
    </>
  );
}
