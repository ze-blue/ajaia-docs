'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/access';
import { SharePanel } from './SharePanel';
import { Toolbar } from './Toolbar';

type Props = {
  doc: { id: string; title: string; content: string; version: number; owner_name: string; role: Role };
  userName: string;
};

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

const AUTOSAVE_MS = 800;

export function DocumentEditor({ doc, userName }: Props) {
  const editable = doc.role !== 'viewer';
  const [title, setTitle] = useState(doc.title);
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Refs so the debounced save always sees the latest values without re-subscribing.
  const version = useRef(doc.version);
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  // Sends pending changes one request at a time. Edits that arrive while a request is
  // in flight are picked up by the next loop iteration, so saves never overlap or reorder.
  const flush = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      while (Object.keys(pending.current).length > 0) {
        const patch = pending.current;
        pending.current = {};
        setState('saving');
        try {
          const res = await fetch(`/api/documents/${doc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...patch, baseVersion: version.current }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.status === 409) {
            setState('conflict');
            setError(body.error);
            return;
          }
          if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
          version.current = body.version;
          setError(null);
        } catch (e) {
          // Put the unsaved changes back so the next attempt includes them.
          pending.current = { ...patch, ...pending.current };
          setState('error');
          setError(e instanceof Error ? e.message : 'Save failed');
          return;
        }
      }
      setState('saved');
    } finally {
      inFlight.current = false;
    }
  }, [doc.id]);

  const schedule = useCallback(
    (change: { title?: string; content?: string }) => {
      pending.current = { ...pending.current, ...change };
      setState((s) => (s === 'conflict' ? s : 'dirty'));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !editable } })],
    content: doc.content,
    editable,
    immediatelyRender: false, // required for SSR with Next.js
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none min-h-[60vh] focus:outline-none',
        'aria-label': 'Document content',
      },
    },
    onUpdate: ({ editor: e }) => schedule({ content: e.getHTML() }),
  });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state !== 'saved') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  const statusText: Record<SaveState, string> = {
    saved: 'All changes saved',
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    error: 'Save failed — retrying on next edit',
    conflict: 'Conflict',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-2">
          <Link href="/" className="text-sm text-blue-700 hover:underline" title="Back to documents">
            ← Docs
          </Link>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) schedule({ title: e.target.value });
            }}
            onBlur={() => {
              if (!title.trim()) setTitle(doc.title); // don't allow an empty title
            }}
            readOnly={!editable}
            maxLength={200}
            aria-label="Document title"
            className="min-w-0 flex-1 rounded px-2 py-1 text-lg font-medium hover:bg-gray-50 focus:bg-white focus:outline focus:outline-blue-300"
          />
          <span className="hidden text-xs text-gray-500 sm:inline" aria-live="polite">
            {editable ? statusText[state] : 'View only'}
          </span>
          {doc.role !== 'owner' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              Shared by {doc.owner_name} · {doc.role}
            </span>
          )}
          <a
            href={`/api/documents/${doc.id}/export`}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            title="Download as Markdown"
          >
            Export .md
          </a>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {doc.role === 'owner' ? 'Share' : 'Access'}
          </button>
          <span className="hidden text-xs text-gray-400 md:inline">{userName}</span>
        </div>
        {editable && editor && <Toolbar editor={editor} />}
      </header>

      {error && (
        <div role="alert" className="mx-auto mt-4 flex max-w-3xl items-center justify-between rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <span>{error}</span>
          {state === 'conflict' && (
            <button className="underline" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
        </div>
      )}

      <main className="mx-auto my-6 max-w-3xl rounded-lg bg-white px-12 py-10 shadow-sm ring-1 ring-gray-200">
        <EditorContent editor={editor} />
      </main>

      {shareOpen && <SharePanel docId={doc.id} isOwner={doc.role === 'owner'} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
