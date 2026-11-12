'use client';

import { useEffect, useState } from 'react';
import type { Revision } from '@/lib/documents';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
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
        if (!r.ok) throw new Error(body.error ?? 'Could not load this version.');
        if (!cancelled) setPreview({ id: selected, html: body.content });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [docId, selected]);

  const isLatest = selected !== null && revisions?.[0]?.id === selected;

  return (
    <Dialog title="Version history" variant="drawer" onClose={onClose}>
      <div className="flex min-h-0 flex-1">
        {/* On phones the list and the preview are separate steps; side by side from sm up. */}
        <ul
          className={`w-full shrink-0 overflow-y-auto py-2 sm:block sm:w-60 sm:border-r sm:border-line ${selected ? 'hidden' : ''}`}
        >
          {revisions === null && !error && (
            <li className="animate-pulse space-y-2 px-5 py-3" role="status" aria-label="Loading versions">
              <span className="block h-3 w-32 rounded bg-gray-200" />
              <span className="block h-3 w-20 rounded bg-gray-100" />
            </li>
          )}
          {revisions?.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                aria-current={selected === r.id}
                className={`block w-full border-l-2 px-5 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                  selected === r.id ? 'border-accent bg-accent-soft' : 'border-transparent'
                }`}
              >
                <span className="block font-medium">
                  <LocalTime iso={new Date(r.updated_at).toISOString()} />
                </span>
                <span className="block text-xs text-muted">
                  {r.author_name}
                  {i === 0 && ' · Current version'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className={`min-w-0 flex-1 flex-col sm:flex ${selected ? 'flex' : 'hidden'}`}>
          {selected && (
            <button type="button" onClick={() => setSelected(null)} className="btn btn-quiet m-2 self-start sm:hidden">
              <Icon name="back" /> All versions
            </button>
          )}
          {error && (
            <p role="alert" className="m-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {!selected && !error && (
            <p className="m-auto max-w-xs p-6 text-center text-sm text-muted">Choose a version to preview it.</p>
          )}
          {selected && !error && (!preview || preview.id !== selected) && (
            <div className="animate-pulse space-y-4 px-8 py-6" role="status" aria-label="Loading version">
              <div className="h-7 w-2/3 rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-5/6 rounded bg-gray-100" />
            </div>
          )}
          {preview && preview.id === selected && (
            <>
              <ReadOnlyContent key={preview.id} html={preview.html} className="flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6" />
              {canRestore && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">
                  {(restoreBlockedReason || isLatest) && (
                    <span className="text-xs text-muted">
                      {isLatest ? 'This is the current version.' : restoreBlockedReason}
                    </span>
                  )}
                  <button
                    type="button"
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
                    className="btn btn-primary"
                  >
                    {busy ? 'Restoring…' : 'Restore this version'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
