'use client';

import type { Presence } from '@/lib/documents';

const COLORS = ['bg-rose-500', 'bg-emerald-600', 'bg-violet-600', 'bg-sky-600', 'bg-amber-600'];

function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Avatars for the other people who currently have this document open. */
export function PresenceAvatars({ people }: { people: Presence[] }) {
  if (people.length === 0) return null;
  const label = people.map((p) => `${p.name} (${p.role === 'viewer' ? 'viewing' : 'editing'})`).join(', ');
  return (
    <div className="flex items-center" aria-label={`Also here: ${label}`} title={`Also here: ${label}`}>
      {people.map((p) => (
        <span
          key={p.user_id}
          className={`-ml-1.5 flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white first:ml-0 ${colorFor(p.user_id)}`}
        >
          {initials(p.name)}
        </span>
      ))}
      <span className="ml-2 hidden text-xs text-gray-500 lg:inline">
        {people.length === 1 ? `${people[0].name.split(' ')[0]} is here` : `${people.length} others here`}
      </span>
    </div>
  );
}
