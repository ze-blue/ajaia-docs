// One icon set, one stroke weight. Replaces the mix of emoji, unicode glyphs and text labels.
const PATHS = {
  back: 'M19 12H5M11 6l-6 6 6 6',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  ul: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  ol: 'M10 6h10M10 12h10M10 18h10M4 5.5 5.5 4.5v4M4 15.5c.3-1.2 2.6-1 2.5.3 0 1-2.5 1.5-2.5 3.2h2.7',
  quote: 'M10 7H6a1 1 0 0 0-1 1v4h4v1a3 3 0 0 1-3 3M19 7h-4a1 1 0 0 0-1 1v4h4v1a3 3 0 0 1-3 3',
  divider: 'M4 12h16',
  clear: 'M7 5h11M12.5 5 10 19M4 4l16 16',
  code: 'm8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14',
  insert: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4ZM14 3v4h4M12 11v6M9 14h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-3.5-3.5',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'size-4.5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 2.75 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
