'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DocSummary } from '@/lib/documents';
import { Avatar } from './Avatar';
import { RelativeTime } from './RelativeTime';

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9 13h6M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

function DocRow({ d, shared, me }: { d: DocSummary; shared: boolean; me: string }) {
  return (
    <li>
      <Link
        href={`/docs/${d.id}`}
        className="group flex items-start gap-3 px-4 py-3 transition hover:bg-blue-50/50 focus-visible:bg-blue-50 focus-visible:outline-none"
      >
        <span className="mt-0.5 rounded-md bg-blue-50 p-1.5 group-hover:bg-white">
          <DocIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-gray-900">{d.title}</span>
            {shared ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                {d.role === 'editor' ? 'Can edit' : 'View only'}
              </span>
            ) : (
              d.share_count > 0 && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                  Shared with {d.share_count}
                </span>
              )
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm text-gray-600">{d.snippet || 'Empty document'}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
            {shared && (
              <>
                <Avatar id={d.owner_id} name={d.owner_name} size="sm" />
                <span>{d.owner_name}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>
              Edited <RelativeTime iso={new Date(d.updated_at).toISOString()} />
              {d.updated_by_name && ` by ${d.updated_by_name === me ? 'you' : d.updated_by_name}`}
            </span>
          </span>
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
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
        {title}
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">{docs.length}</span>
      </h2>
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center text-sm text-gray-600">
          {empty}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
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

  return (
    <>
      {owned.length + shared.length > 0 && (
        <div className="relative mt-6">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, content or owner"
            aria-label="Search documents"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
      )}
      <Section
        title="My documents"
        docs={ownedF}
        shared={false}
        me={me}
        empty={
          searching ? (
            'No matching documents.'
          ) : (
            <>
              <p className="font-medium text-gray-900">No documents yet</p>
              <p className="mt-1">Create one, or import a .txt, .md or .docx file to get started.</p>
            </>
          )
        }
      />
      <Section
        title="Shared with me"
        docs={sharedF}
        shared
        me={me}
        empty={searching ? 'No matching documents.' : 'When someone shares a document with you, it shows up here.'}
      />
    </>
  );
}
