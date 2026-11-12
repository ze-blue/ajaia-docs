'use client';

import { type Editor, useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { Icon, type IconName } from './Icon';

type Btn = {
  title: string;
  /** Either an icon, or a letter rendered in the style it applies (the B / I / U convention). */
  icon?: IconName;
  glyph?: { text: string; className: string };
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const HISTORY: Btn[] = [
  { title: 'Undo (Ctrl+Z)', icon: 'undo', isActive: () => false, run: (e) => e.chain().focus().undo().run() },
  { title: 'Redo (Ctrl+Shift+Z)', icon: 'redo', isActive: () => false, run: (e) => e.chain().focus().redo().run() },
];

const MARKS: Btn[] = [
  { title: 'Bold (Ctrl+B)', glyph: { text: 'B', className: 'font-bold' }, isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { title: 'Italic (Ctrl+I)', glyph: { text: 'I', className: 'font-serif italic' }, isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { title: 'Underline (Ctrl+U)', glyph: { text: 'U', className: 'underline underline-offset-2' }, isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { title: 'Strikethrough (Ctrl+Shift+S)', glyph: { text: 'S', className: 'line-through' }, isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  { title: 'Inline code (Ctrl+E)', icon: 'code', isActive: (e) => e.isActive('code'), run: (e) => e.chain().focus().toggleCode().run() },
];

const BLOCKS: Btn[] = [
  { title: 'Bulleted list (Ctrl+Shift+8)', icon: 'ul', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered list (Ctrl+Shift+7)', icon: 'ol', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'Quote (Ctrl+Shift+B)', icon: 'quote', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Divider', icon: 'divider', isActive: () => false, run: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: 'Clear formatting', icon: 'clear', isActive: () => false, run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run() },
];

const STYLES = [
  { value: 'p', label: 'Normal text' },
  { value: '1', label: 'Heading 1' },
  { value: '2', label: 'Heading 2' },
  { value: '3', label: 'Heading 3' },
] as const;

const SHORTCUTS: [string, string][] = [
  ['Bold, italic, underline', 'Ctrl+B, I, U'],
  ['Strikethrough', 'Ctrl+Shift+S'],
  ['Heading 1 to 3, normal text', 'Ctrl+Alt+1 to 3, 0'],
  ['Bulleted, numbered list', 'Ctrl+Shift+8, 7'],
  ['Link', 'Ctrl+K'],
  ['Save now', 'Ctrl+S'],
  ['Undo, redo', 'Ctrl+Z, Ctrl+Shift+Z'],
  ['While typing', '# heading, - list, 1. list, > quote'],
];

const isValidLink = (url: string) => /^(https?:\/\/|mailto:)\S+$/i.test(url);

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const existing = (editor.getAttributes('link').href as string | undefined) ?? '';
  const [url, setUrl] = useState(existing);
  const [error, setError] = useState<string | null>(null);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!isValidLink(value)) return setError('Enter a link that starts with https://, http:// or mailto:');
    onClose();
    editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
  }

  return (
    <Dialog title={existing ? 'Edit link' : 'Add link'} onClose={onClose}>
      <form onSubmit={apply} noValidate>
        <label htmlFor="link-url" className="text-sm font-medium">
          Link address
        </label>
        <input
          id="link-url"
          data-autofocus
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://example.com"
          aria-invalid={error !== null}
          aria-describedby={error ? 'link-error' : undefined}
          className="field mt-1.5"
        />
        {error && (
          <p id="link-error" role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {existing && (
            <button
              type="button"
              className="btn btn-quiet mr-auto"
              onClick={() => {
                onClose();
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
              }}
            >
              Remove link
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary">{existing ? 'Update' : 'Add link'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ToolButton({ b, active, editor }: { b: Btn; active: boolean; editor: Editor }) {
  return (
    <button
      type="button"
      title={b.title}
      aria-label={b.title}
      aria-pressed={active}
      onMouseDown={(ev) => ev.preventDefault()} // keep the editor selection
      onClick={() => b.run(editor)}
      className="icon-btn"
    >
      {b.icon ? <Icon name={b.icon} /> : <span className={`text-[0.9375rem] leading-none ${b.glyph!.className}`}>{b.glyph!.text}</span>}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />;

export function Toolbar({ editor, onError }: { editor: Editor; onError: (message: string) => void }) {
  const all = [...HISTORY, ...MARKS, ...BLOCKS];
  // Re-render only when the active formatting changes, not on every keystroke.
  const ui = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      active: all.map((b) => b.isActive(e)),
      link: e.isActive('link'),
      style: ([1, 2, 3] as const).find((l) => e.isActive('heading', { level: l })) ?.toString() ?? 'p',
    }),
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const [inserting, setInserting] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Ctrl+K for links (Tiptap has no default binding for it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && editor.isFocused) {
        e.preventDefault();
        setLinkOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  // The shortcuts popover closes on Escape or an outside click.
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHelpOpen(false);
        helpButton.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-shortcuts]')) setHelpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [helpOpen]);

  async function insertFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return onError('That file is larger than 2 MB.');
    setInserting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/convert', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not read that file.');
      editor.chain().focus().insertContent(body.html).run(); // saved by the normal autosave path
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setInserting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const stateOf = (b: Btn) => ui.active[all.indexOf(b)];

  return (
    <div className="relative border-t border-line" data-shortcuts>
      {/* One row that scrolls sideways on phones and wraps from tablet up, so nothing is clipped. */}
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center gap-0.5 overflow-x-auto py-1 pr-10 pl-2 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] sm:flex-wrap sm:overflow-visible sm:px-3"
      >
        {HISTORY.map((b) => (
          <ToolButton key={b.title} b={b} active={false} editor={editor} />
        ))}
        <Divider />
        <select
          aria-label="Text style"
          title="Text style"
          value={ui.style}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level: Number(v) as 1 | 2 | 3 }).run();
          }}
          className="h-9 shrink-0 cursor-pointer rounded-lg bg-transparent px-2 text-sm text-ink hover:bg-gray-100"
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Divider />
        {MARKS.map((b) => (
          <ToolButton key={b.title} b={b} active={stateOf(b)} editor={editor} />
        ))}
        <button
          type="button"
          title="Link (Ctrl+K)"
          aria-label="Link (Ctrl+K)"
          aria-pressed={ui.link}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => setLinkOpen(true)}
          className="icon-btn"
        >
          <Icon name="link" />
        </button>
        <Divider />
        {BLOCKS.map((b) => (
          <ToolButton key={b.title} b={b} active={stateOf(b)} editor={editor} />
        ))}
        <Divider />
        <button
          type="button"
          disabled={inserting}
          onClick={() => fileInput.current?.click()}
          title="Insert the contents of a .txt, .md or .docx file (up to 2 MB) at the cursor"
          className="btn btn-quiet"
        >
          <Icon name="insert" />
          {inserting ? 'Inserting…' : 'Insert file'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.docx"
          className="hidden"
          tabIndex={-1}
          aria-label="Insert file"
          onChange={(e) => insertFile(e.target.files?.[0])}
        />
        <button
          ref={helpButton}
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          aria-expanded={helpOpen}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="icon-btn sm:ml-auto"
        >
          <Icon name="help" />
        </button>
      </div>

      {helpOpen && (
        <div className="surface absolute top-full right-2 z-20 mt-1 w-[min(22rem,calc(100vw-1rem))] p-4 text-sm shadow-lg">
          <h3 className="mb-2 font-semibold">Keyboard shortcuts</h3>
          <dl className="space-y-1.5">
            {SHORTCUTS.map(([what, keys]) => (
              <div key={what} className="flex justify-between gap-4">
                <dt className="text-muted">{what}</dt>
                <dd className="text-right font-mono text-xs">{keys}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {linkOpen && <LinkDialog editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}
