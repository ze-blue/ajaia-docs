'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 30_000); // keep "2 min ago" fresh
  return () => clearInterval(t);
};

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'just now';
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    abs < 3600
      ? [Math.round(diffSec / 60), 'minute']
      : abs < 86400
        ? [Math.round(diffSec / 3600), 'hour']
        : abs < 86400 * 7
          ? [Math.round(diffSec / 86400), 'day']
          : [0, 'day'];
  if (unit === 'day' && value === 0 && abs >= 86400 * 7) {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  }
  return rtf ? rtf.format(value, unit) : new Date(iso).toLocaleString();
}

/** "5 minutes ago", rendered in the viewer's locale; full timestamp on hover. */
export function RelativeTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatRelative(iso),
    () => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
  );
  const full = useSyncExternalStore(
    subscribe,
    () => new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }),
    () => iso,
  );
  return (
    <time dateTime={iso} title={full}>
      {text}
    </time>
  );
}
