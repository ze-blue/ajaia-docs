const COLORS = ['bg-rose-600', 'bg-emerald-700', 'bg-violet-600', 'bg-sky-700', 'bg-amber-700', 'bg-teal-700'];

/** Stable color per user id, so a person looks the same everywhere in the app. */
export function avatarColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 37 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const SIZES = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' } as const;

export function Avatar({
  id,
  name,
  size = 'md',
  className = '',
}: {
  id: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZES[size]} ${avatarColor(id)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
