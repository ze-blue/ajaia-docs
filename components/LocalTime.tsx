'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Renders a timestamp in the viewer's own time zone (the server only knows UTC). */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    () => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
  );
  return <time dateTime={iso}>{text}</time>;
}
