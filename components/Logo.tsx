export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2563eb" />
      <path d="M10 8h8l5 5v11a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" fill="#fff" />
      <path d="M18 8v5h5" fill="#bfdbfe" />
      <path d="M12 16h8M12 19h8M12 22h5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-gray-900">
      <LogoMark />
      Ajaia Docs
    </span>
  );
}
