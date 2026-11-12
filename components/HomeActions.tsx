'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const MAX_BYTES = 2 * 1024 * 1024;

/** Page title row with the two ways to start a document. Files can also be dropped anywhere on the page. */
export function HomeActions() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'create' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function send(kind: 'create' | 'import', init: RequestInit, url: string) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status}). Try again.`);
      router.push(`/docs/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBusy(null);
    }
  }

  function importFile(file: File | undefined) {
    if (!file) return;
    if (fileInput.current) fileInput.current.value = '';
    if (file.size > MAX_BYTES) return setError('That file is larger than 2 MB.');
    const form = new FormData();
    form.append('file', file);
    send('import', { method: 'POST', body: form }, '/api/import');
  }

  // Whole-page drop target, so there is no dashed box competing with the document list.
  const importRef = useRef(importFile);
  useEffect(() => {
    importRef.current = importFile;
  });
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      importRef.current(e.dataTransfer?.files[0]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <div className="flex gap-2">
          <button type="button" disabled={busy !== null} onClick={() => fileInput.current?.click()} className="btn btn-secondary">
            <Icon name="upload" />
            {busy === 'import' ? 'Importing…' : 'Import file'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              send('create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, '/api/documents')
            }
            className="btn btn-primary"
          >
            <Icon name="plus" />
            {busy === 'create' ? 'Creating…' : 'New document'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">Import or drop a .txt, .md or .docx file, up to 2 MB.</p>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        tabIndex={-1}
        aria-label="Import file"
        onChange={(e) => importFile(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-accent/10 p-6">
          <div className="surface flex items-center gap-3 px-6 py-4 text-sm font-medium ring-2 ring-accent">
            <Icon name="upload" className="size-5 text-accent" />
            Drop to import as a new document
          </div>
        </div>
      )}
    </div>
  );
}
