'use client';

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal primitive: traps Tab inside, closes on Escape or scrim click, locks page
 * scroll, and returns focus to whatever opened it. `drawer` slides in from the right and is
 * full-width on phones; `modal` is a centered card on desktop and a bottom sheet on phones.
 */
export function Dialog({
  title,
  onClose,
  children,
  variant = 'modal',
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'modal' | 'drawer';
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = panel.current!;
    const initial = node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>(FOCUSABLE);
    (initial ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const drawer = variant === 'drawer';
  return (
    <div
      className={`fixed inset-0 z-40 flex bg-gray-900/40 ${drawer ? 'justify-end' : 'items-end justify-center sm:items-start sm:pt-24'}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          drawer
            ? 'flex h-full w-full flex-col bg-white sm:max-w-2xl sm:border-l sm:border-line'
            : 'flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-xl'
        }
      >
        <div className="flex items-center justify-between gap-4 border-b border-line py-2 pr-2 pl-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 ${drawer ? 'flex flex-col' : 'overflow-y-auto p-5'}`}>{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
