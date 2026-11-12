'use client';

import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/access';
import type { Presence } from '@/lib/documents';
import { HistoryPanel } from './HistoryPanel';
import { LogoMark } from './Logo';
import { PresenceAvatars } from './PresenceAvatars';
import { SharePanel } from './SharePanel';
import { Toolbar } from './Toolbar';

type Props = {
  doc: {
    id: string;
    title: string;
    content: string;
    version: number;
    owner_name: string;
    updated_by_name: string | null;
    role: Role;
  };
  userName: string;
};

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

const AUTOSAVE_MS = 800;
const PRESENCE_POLL_MS = 5000;

const STATUS_TEXT: Record<SaveState, string> = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes…',
  saving: 'Saving…',
  error: 'Save failed. Will retry on your next edit.',
  conflict: 'Not saved: newer version exists',
};

const STATUS_DOT: Record<SaveState, string> = {
  saved: 'bg-green-500',
  dirty: 'bg-amber-400',
  saving: 'bg-amber-400 animate-pulse',
  error: 'bg-red-500',
  conflict: 'bg-red-500',
};

function WordCount({ editor }: { editor: Editor }) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => e.getText().trim().split(/\s+/).filter(Boolean).length,
  });
  return (
    <span>
      {words} {words === 1 ? 'word' : 'words'}
    </span>
  );
}

export function DocumentEditor({ doc, userName }: Props) {
  const router = useRouter();
  const editable = doc.role !== 'viewer';
  const [title, setTitle] = useState(doc.title);
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<'share' | 'history' | null>(null);
  const [others, setOthers] = useState<Presence[]>([]);
  const [remoteEditor, setRemoteEditor] = useState<string | null>(null); // someone saved while we had unsaved edits
  const [lastEditedBy, setLastEditedBy] = useState(doc.updated_by_name);
  const [accessLost, setAccessLost] = useState(false);
  const [roleChangedTo, setRoleChangedTo] = useState<Role | null>(null);
  const savedTitle = useRef(doc.title); // what the server has, for resetting a cleared title field

  // Refs so async callbacks always see current values without re-subscribing.
  const version = useRef(doc.version);
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const stateRef = useRef<SaveState>('saved');
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const hasLocalChanges = () => inFlight.current || Object.keys(pending.current).length > 0;

  // ---- Autosave -----------------------------------------------------------
  // Sends pending changes one request at a time. Edits made while a request is in flight
  // are picked up by the next loop iteration, so saves never overlap or arrive out of order.
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
          if (patch.title !== undefined) savedTitle.current = patch.title;
          setLastEditedBy(userName);
          setError(null);
          // A successful versioned save proves nobody else saved in between, so any
          // "someone saved a newer version" warning was about our own save.
          setRemoteEditor(null);
        } catch (e) {
          pending.current = { ...patch, ...pending.current }; // keep unsaved changes for the next attempt
          setState('error');
          setError(e instanceof Error ? e.message : 'Save failed');
          return;
        }
      }
      setState('saved');
    } finally {
      inFlight.current = false;
    }
  }, [doc.id, userName]);

  const schedule = useCallback(
    (change: { title?: string; content?: string }) => {
      pending.current = { ...pending.current, ...change };
      setState((s) => (s === 'conflict' ? s : 'dirty'));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void flush();
  }, [flush]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !editable } }),
      Placeholder.configure({ placeholder: editable ? 'Start writing…' : 'This document is empty.' }),
    ],
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

  /**
   * Replace editor content without triggering a save, keeping the cursor roughly in place.
   * Kept out of undo history: otherwise Ctrl+Z would revert a collaborator's changes and the
   * autosave would quietly write that reversion back over their work.
   */
  const replaceContent = useCallback(
    (html: string) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      editor.chain().setMeta('addToHistory', false).setContent(html, { emitUpdate: false }).run();
      const max = editor.state.doc.content.size;
      editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
    },
    [editor],
  );

  // ---- Presence + live updates (heartbeat polling) ------------------------
  // Every few seconds: tell the server we're here, learn who else is, and whether someone else
  // saved. If we have no unsaved edits we pull their changes in automatically; if we do, we
  // show a banner instead of clobbering either side (the next save would get a 409 anyway).
  useEffect(() => {
    if (!editor) return;
    let stopped = false;

    const pullLatest = async () => {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (!res.ok || stopped) return;
      const fresh = await res.json();
      if (hasLocalChanges() || fresh.version <= version.current) return; // user started typing meanwhile
      replaceContent(fresh.content);
      version.current = fresh.version;
      savedTitle.current = fresh.title;
      setTitle(fresh.title);
      setLastEditedBy(fresh.updated_by_name);
      setNotice(`Updated with changes from ${fresh.updated_by_name ?? 'a collaborator'}`);
    };

    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/documents/${doc.id}/presence`, { method: 'POST' });
        if (stopped) return;
        if (res.status === 404 || res.status === 401) {
          setAccessLost(true);
          editor.setEditable(false);
          return;
        }
        if (!res.ok) return;
        const hb = await res.json();
        setOthers(hb.active);
        // Owner changed our access while the page was open: stop editing at once if downgraded.
        if (hb.role !== doc.role) {
          setRoleChangedTo(hb.role);
          if (hb.role === 'viewer') editor.setEditable(false);
        }
        // While our own save is in flight the server may already be at our new version before
        // the response arrives; comparing now would mistake our save for someone else's.
        if (inFlight.current) return;
        if (hb.version > version.current) {
          if (!hasLocalChanges() && stateRef.current !== 'conflict') await pullLatest();
          else setRemoteEditor(hb.updated_by_name ?? 'Someone');
        }
      } catch {
        // Network blips are fine; the next tick retries.
      }
    };

    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, PRESENCE_POLL_MS);
    const onVisible = () => !document.hidden && tick();
    const leave = () => {
      fetch(`/api/documents/${doc.id}/presence`, { method: 'DELETE', keepalive: true }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', leave);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [editor, doc.id, doc.role, replaceContent]);

  // ---- Small UX details -----------------------------------------------------
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Ctrl/Cmd+S saves immediately instead of opening the browser's "Save page" dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (editable) saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, saveNow]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state !== 'saved') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  async function restore(revisionId: string) {
    const res = await fetch(`/api/documents/${doc.id}/revisions/${revisionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseVersion: version.current }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Restore failed.');
    // Anything typed while the restore was in flight is based on the replaced content;
    // drop it rather than let a later autosave write it back over the restored version.
    if (timer.current) clearTimeout(timer.current);
    pending.current = {};
    replaceContent(body.content);
    version.current = body.version;
    savedTitle.current = body.title;
    setTitle(body.title);
    setState('saved');
    setLastEditedBy(userName);
    setNotice('Earlier version restored. You can undo this from history too.');
  }

  async function deleteDoc() {
    if (!window.confirm(`Delete "${title}" for everyone? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Delete failed.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  /** In-app navigation skips `beforeunload`, so save (or confirm) before leaving the editor. */
  async function leaveEditor(e: React.MouseEvent) {
    const saveState = () => stateRef.current; // read fresh each time; it changes while we await
    if (saveState() === 'saved') return;
    e.preventDefault();
    if (saveState() === 'dirty' || saveState() === 'saving') {
      if (timer.current) clearTimeout(timer.current);
      for (let i = 0; i < 50 && (inFlight.current || Object.keys(pending.current).length > 0); i++) {
        if (!inFlight.current) void flush();
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 50)); // let the final state update reach stateRef
    }
    if (saveState() === 'saved' || window.confirm('Your latest changes were not saved. Leave anyway?')) {
      router.push('/');
    }
  }

  const banner =
    accessLost
      ? { text: 'You no longer have access to this document.', action: null }
      : roleChangedTo
        ? {
            text:
              roleChangedTo === 'viewer'
                ? 'The owner changed your access to view-only. Editing is disabled.'
                : `The owner changed your access to ${roleChangedTo}. Reload to start editing.`,
            action: 'Reload',
          }
        : remoteEditor
        ? {
            text: `${remoteEditor} saved a newer version while you were editing. Reload to get it (your unsaved changes here will be lost).`,
            action: 'Reload',
          }
        : error
          ? { text: error, action: state === 'conflict' ? 'Reload' : null }
          : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <Link
            href="/"
            onClick={leaveEditor}
            aria-label="Back to documents"
            title="Back to documents"
            className="flex items-center gap-1 rounded-md p-1 text-gray-600 hover:bg-gray-100"
          >
            <span aria-hidden>←</span>
            <LogoMark className="size-7" />
          </Link>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) schedule({ title: e.target.value });
            }}
            onBlur={() => {
              if (!title.trim()) setTitle(savedTitle.current); // an empty title is never saved
            }}
            readOnly={!editable}
            maxLength={200}
            aria-label="Document title"
            className="min-w-40 flex-1 rounded px-2 py-1 text-lg font-medium hover:bg-gray-50 focus:bg-white focus:outline focus:outline-blue-300"
          />
          <span className="flex items-center gap-1.5 text-xs text-gray-600" aria-live="polite">
            <span aria-hidden className={`size-2 rounded-full ${editable ? STATUS_DOT[state] : 'bg-gray-400'}`} />
            {editable ? STATUS_TEXT[state] : 'View only'}
          </span>
          {doc.role !== 'owner' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              Shared by {doc.owner_name} · {doc.role}
            </span>
          )}
          <PresenceAvatars people={others} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPanel('history')}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              History
            </button>
            <a
              href={`/api/documents/${doc.id}/export`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              title="Download as Markdown"
            >
              Export .md
            </a>
            {doc.role === 'owner' && (
              <button
                type="button"
                onClick={deleteDoc}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanel('share')}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {doc.role === 'owner' ? 'Share' : 'Access'}
            </button>
          </div>
        </div>
        {editable && editor && !accessLost && roleChangedTo !== 'viewer' && <Toolbar editor={editor} onError={setError} />}
      </header>

      {banner && (
        <div
          role="alert"
          className="mx-auto mt-4 flex max-w-3xl items-center justify-between gap-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          <span>{banner.text}</span>
          {banner.action && (
            <button className="shrink-0 font-medium underline" onClick={() => window.location.reload()}>
              {banner.action}
            </button>
          )}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {notice}
        </div>
      )}

      <main className="mx-auto my-6 max-w-3xl rounded-lg bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200 sm:px-12 sm:py-10">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-[60vh] animate-pulse space-y-4" aria-label="Loading document" role="status">
            <div className="h-8 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-5/6 rounded bg-gray-100" />
            <div className="h-4 w-4/6 rounded bg-gray-100" />
          </div>
        )}
      </main>
      <footer className="mx-auto mb-8 flex max-w-3xl justify-between px-4 text-xs text-gray-600">
        {editor ? <WordCount editor={editor} /> : <span />}
        <span>
          {[lastEditedBy && `Last edited by ${lastEditedBy === userName ? 'you' : lastEditedBy}`, editable && 'Ctrl+S saves now']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </footer>

      {panel === 'share' && (
        <SharePanel docId={doc.id} isOwner={doc.role === 'owner'} onClose={() => setPanel(null)} />
      )}
      {panel === 'history' && (
        <HistoryPanel
          docId={doc.id}
          canRestore={editable && !accessLost}
          restoreBlockedReason={state === 'saved' ? null : 'Wait for your changes to save first.'}
          onRestore={restore}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
