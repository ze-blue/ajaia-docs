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
import { Dialog } from './Dialog';
import { Icon, type IconName } from './Icon';
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
  error: 'Not saved',
  conflict: 'Not saved',
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
  const [panel, setPanel] = useState<'share' | 'history' | 'delete' | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => ({}))) ?? {};
      setDeleting(false);
      setPanel(null);
      setError(body.error ?? 'Could not delete the document. Try again.');
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

  const banner: { text: string; action: string | null; tone: 'error' | 'warning' } | null = accessLost
    ? { text: 'You no longer have access to this document.', action: null, tone: 'error' }
    : roleChangedTo
      ? {
          text:
            roleChangedTo === 'viewer'
              ? 'The owner changed your access to view only, so editing is off.'
              : 'The owner gave you edit access. Reload to start editing.',
          action: roleChangedTo === 'viewer' ? null : 'Reload',
          tone: 'warning',
        }
      : remoteEditor
        ? {
            text: `${remoteEditor} saved a newer version while you were typing. Reload to see it. Your unsaved changes here will be lost.`,
            action: 'Reload',
            tone: 'warning',
          }
        : error
          ? { text: error, action: state === 'conflict' ? 'Reload' : null, tone: 'error' }
          : null;

  const canEditNow = editable && !accessLost && roleChangedTo !== 'viewer';
  const statusLabel = canEditNow ? STATUS_TEXT[state] : 'View only';

  return (
    <div className="min-h-screen bg-white sm:bg-canvas">
      <header className="top-0 z-10 border-b border-line bg-white [@media(min-height:600px)]:sticky">
        <div className="flex items-center gap-1 px-2 py-1.5 sm:gap-2 sm:px-3">
          <Link href="/" onClick={leaveEditor} aria-label="Back to documents" title="Back to documents" className="icon-btn">
            <Icon name="back" />
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
            readOnly={!canEditNow}
            maxLength={200}
            aria-label="Document title"
            className="h-9 min-w-0 flex-1 truncate rounded-lg px-2 text-base font-semibold hover:bg-gray-100 focus:bg-white read-only:hover:bg-transparent"
          />
          <span className="flex shrink-0 items-center gap-1.5 px-1 text-xs text-muted" aria-live="polite">
            <span aria-hidden className={`size-2 rounded-full ${canEditNow ? STATUS_DOT[state] : 'bg-gray-400'}`} />
            <span className={canEditNow && state === 'saved' ? 'max-sm:sr-only' : ''}>{statusLabel}</span>
          </span>
          {doc.role !== 'owner' && (
            <span className="hidden shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 md:inline">
              Shared by {doc.owner_name}
            </span>
          )}
          <PresenceAvatars people={others} />
          <MoreMenu
            items={[
              { label: 'Version history', icon: 'history', onSelect: () => setPanel('history') },
              { label: 'Export as Markdown', icon: 'download', href: `/api/documents/${doc.id}/export` },
              ...(doc.role === 'owner'
                ? [{ label: 'Delete document', icon: 'trash' as const, danger: true, onSelect: () => setPanel('delete') }]
                : []),
            ]}
          />
          <button
            type="button"
            onClick={() => setPanel('share')}
            className={`btn ${doc.role === 'owner' ? 'btn-primary' : 'btn-secondary'}`}
          >
            {doc.role === 'owner' ? 'Share' : 'Access'}
          </button>
        </div>
        {canEditNow && editor && <Toolbar editor={editor} onError={setError} />}
      </header>

      {banner && (
        <div
          role="alert"
          className={`mx-3 mt-3 flex max-w-3xl items-center justify-between gap-4 rounded-lg px-4 py-2.5 text-sm sm:mx-auto ${
            banner.tone === 'error' ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          <span>{banner.text}</span>
          {banner.action && (
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              {banner.action}
            </button>
          )}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-20 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-sm text-white"
        >
          {notice}
        </div>
      )}

      {/* The page: full-bleed on phones, a hairline sheet on the canvas from tablet up. */}
      <main className="mx-auto w-full max-w-3xl bg-white px-5 py-8 sm:my-6 sm:w-[calc(100%-3rem)] sm:rounded-xl sm:px-14 sm:py-12 sm:ring-1 sm:ring-line">
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
      <footer className="mx-auto flex max-w-3xl justify-between gap-4 px-5 pb-8 text-xs text-muted sm:w-[calc(100%-3rem)] sm:px-2">
        {editor ? <WordCount editor={editor} /> : <span />}
        {lastEditedBy && <span>Last edited by {lastEditedBy === userName ? 'you' : lastEditedBy}</span>}
      </footer>

      {panel === 'share' && <SharePanel docId={doc.id} isOwner={doc.role === 'owner'} onClose={() => setPanel(null)} />}
      {panel === 'history' && (
        <HistoryPanel
          docId={doc.id}
          canRestore={canEditNow}
          restoreBlockedReason={state === 'saved' ? null : 'Your changes are still saving.'}
          onRestore={restore}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'delete' && (
        <Dialog title="Delete this document?" onClose={() => setPanel(null)}>
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{title}</span> will be deleted for you and everyone it is shared with.
            This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" data-autofocus className="btn btn-secondary" onClick={() => setPanel(null)}>
              Cancel
            </button>
            <button type="button" disabled={deleting} className="btn btn-danger" onClick={deleteDoc}>
              {deleting ? 'Deleting…' : 'Delete document'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

type MenuItem = { label: string; icon: IconName; danger?: boolean; href?: string; onSelect?: () => void };

/** Overflow menu for secondary document actions, with standard menu keyboard behavior. */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const els = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    const focusAt = (n: number) => {
      e.preventDefault();
      els[(n + els.length) % els.length]?.focus();
    };
    if (e.key === 'ArrowDown') focusAt(i + 1);
    else if (e.key === 'ArrowUp') focusAt(i - 1);
    else if (e.key === 'Home') focusAt(0);
    else if (e.key === 'End') focusAt(els.length - 1);
    else if (e.key === 'Escape') {
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  }

  const itemClass = (danger?: boolean) =>
    `flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-gray-100 focus-visible:bg-gray-100 ${
      danger ? 'text-danger' : 'text-ink'
    }`;

  return (
    <div className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label="More actions"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="icon-btn"
      >
        <Icon name="more" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="More actions"
          onKeyDown={onKeyDown}
          className="surface absolute top-full right-0 z-30 mt-1 w-56 p-1 shadow-lg"
        >
          {items.map((it) =>
            it.href ? (
              <a key={it.label} role="menuitem" href={it.href} onClick={() => setOpen(false)} className={itemClass(it.danger)}>
                <Icon name={it.icon} />
                {it.label}
              </a>
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={itemClass(it.danger)}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus(); // so the dialog this opens returns focus here
                  it.onSelect?.();
                }}
              >
                <Icon name={it.icon} />
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
