'use client';

import type { Presence } from '@/lib/documents';
import { Avatar } from './Avatar';

/** Avatars for the other people who currently have this document open. */
export function PresenceAvatars({ people }: { people: Presence[] }) {
  if (people.length === 0) return null;
  const label = people.map((p) => `${p.name} (${p.role === 'viewer' ? 'viewing' : 'editing'})`).join(', ');
  return (
    <div className="flex items-center" aria-label={`Also here: ${label}`} title={`Also here: ${label}`}>
      {people.map((p) => (
        <span key={p.user_id} className="relative -ml-1.5 first:ml-0">
          <Avatar id={p.user_id} name={p.name} size="md" className="ring-2 ring-white" />
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-green-500 ring-2 ring-white" aria-hidden />
        </span>
      ))}
      <span className="ml-2 hidden text-xs text-gray-600 lg:inline">
        {people.length === 1 ? `${people[0].name.split(' ')[0]} is here` : `${people.length} others here`}
      </span>
    </div>
  );
}
