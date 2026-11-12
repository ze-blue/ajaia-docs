'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

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
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      router.push(`/docs/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setBusy(null);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('File is larger than 2 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    send('import', { method: 'POST', body: form }, '/api/import');
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div
      className={`-mx-4 mt-4 rounded-xl border-2 border-dashed p-4 transition ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-transparent'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy !== null}
          onClick={() =>
            send('create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, '/api/documents')
          }
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === 'create' ? 'Creating…' : '+ New document'}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => fileInput.current?.click()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {busy === 'import' ? 'Importing…' : 'Import file'}
        </button>
        <span className="text-xs text-gray-600">
          {dragging
            ? 'Drop to import as a new document'
            : 'Or drag a file here. Supports .txt, .md and .docx up to 2 MB; each becomes a new editable document.'}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
