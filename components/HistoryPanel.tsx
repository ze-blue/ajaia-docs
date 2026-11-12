'use client';

import { useEffect, useState } from 'react';
import type { Revision } from '@/lib/documents';
import { LocalTime } from './LocalTime';
import { ReadOnlyContent } from './ReadOnlyContent';

type Props = {
  docId: string;
  canRestore: boolean;
  /** Why restore is temporarily unavailable (e.g. unsaved changes), or null. */
  restoreBlockedReason: string | null;
  onRestore: (revisionId: string) => Promise<void>;
  onClose: () => void;
};

export function HistoryPanel({ docId, canRestore, restoreBlockedReason, onRestore, onClose }: Props) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${docId}/revisions`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Could not load history.');
        if (!cancelled) setRevisions(body.revisions);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/documents/${docId}/revisions/${selected}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Could not load revision.');
        if (!cancelled) setPreview({ id: selected, html: body.content });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [docId, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isLatest = selected !== null && revisions?.[0]?.id === selected;

  return (
    <aside
      aria-label="Version history"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="font-semibold">Version history</h2>
        <button onClick={onClose} className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" aria-label="Close history">
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <ul className="w-56 shrink-0 overflow-y-auto border-r border-gray-100 py-2 text-sm">
          {revisions === null && !error && <li className="px-4 py-2 text-gray-500">Loading…</li>}
          {revisions?.map((r, i) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r.id)}
                aria-current={selected === r.id}
                className={`block w-full px-4 py-2 text-left hover:bg-gray-50 ${selected === r.id ? 'bg-blue-50' : ''}`}
              >
                <span className="block font-medium text-gray-900">
                  <LocalTime iso={new Date(r.updated_at).toISOString()} />
                </span>
                <span className="block text-xs text-gray-500">
                  {r.author_name}
                  {i === 0 && ' · current'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex min-w-0 flex-1 flex-col">
          {error && (
            <p role="alert" className="m-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {!preview && !error && (
            <p className="m-6 text-sm text-gray-500">
              Select a version to preview it. A new version is recorded when a different person edits, or after a minute of
              editing.
            </p>
          )}
          {preview && (
            <>
              <ReadOnlyContent key={preview.id} html={preview.html} className="flex-1 overflow-y-auto px-8 py-6" />
              {canRestore && (
                <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
                  {restoreBlockedReason && <span className="text-xs text-gray-500">{restoreBlockedReason}</span>}
                  <button
                    disabled={busy || isLatest || restoreBlockedReason !== null}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await onRestore(preview.id);
                        onClose();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Restore failed.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLatest ? 'This is the current version' : busy ? 'Restoring…' : 'Restore this version'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
