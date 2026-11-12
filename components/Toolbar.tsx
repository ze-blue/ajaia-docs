'use client';

import { type Editor, useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

type Btn = {
  label: string;
  title: string;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
  className?: string;
};

function promptForLink(e: Editor) {
  const current = e.getAttributes('link').href as string | undefined;
  const input = window.prompt('Link URL (leave empty to remove the link)', current ?? 'https://');
  if (input === null) return; // cancelled
  const url = input.trim();
  if (url === '' || url === 'https://') {
    e.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  if (!/^(https?:\/\/|mailto:)/i.test(url)) {
    window.alert('Links must start with http://, https:// or mailto:');
    return;
  }
  e.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

const GROUPS: Btn[][] = [
  [
    { label: '↶', title: 'Undo (Ctrl+Z)', isActive: () => false, run: (e) => e.chain().focus().undo().run() },
    { label: '↷', title: 'Redo (Ctrl+Shift+Z)', isActive: () => false, run: (e) => e.chain().focus().redo().run() },
  ],
  [
    { label: 'Normal', title: 'Normal text (Ctrl+Alt+0)', isActive: (e) => e.isActive('paragraph'), run: (e) => e.chain().focus().setParagraph().run() },
    { label: 'H1', title: 'Heading 1 (Ctrl+Alt+1)', isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'H2', title: 'Heading 2 (Ctrl+Alt+2)', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'H3', title: 'Heading 3 (Ctrl+Alt+3)', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
    { label: 'I', title: 'Italic (Ctrl+I)', className: 'italic font-serif', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
    { label: 'U', title: 'Underline (Ctrl+U)', className: 'underline', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
    { label: 'S', title: 'Strikethrough (Ctrl+Shift+S)', className: 'line-through', isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
    { label: '</>', title: 'Inline code (Ctrl+E)', className: 'font-mono text-xs', isActive: (e) => e.isActive('code'), run: (e) => e.chain().focus().toggleCode().run() },
    { label: '🔗', title: 'Link (Ctrl+K)', isActive: (e) => e.isActive('link'), run: promptForLink },
  ],
  [
    { label: '• List', title: 'Bulleted list (Ctrl+Shift+8)', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: '1. List', title: 'Numbered list (Ctrl+Shift+7)', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: '❝', title: 'Quote (Ctrl+Shift+B)', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: '―', title: 'Divider', isActive: () => false, run: (e) => e.chain().focus().setHorizontalRule().run() },
    { label: 'T̸', title: 'Clear formatting', isActive: () => false, run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run() },
  ],
];

const SHORTCUTS: [string, string][] = [
  ['Bold / Italic / Underline', 'Ctrl+B / I / U'],
  ['Strikethrough', 'Ctrl+Shift+S'],
  ['Heading 1–3 / Normal', 'Ctrl+Alt+1–3 / 0'],
  ['Bulleted / numbered list', 'Ctrl+Shift+8 / 7'],
  ['Link', 'Ctrl+K'],
  ['Save now', 'Ctrl+S'],
  ['Undo / Redo', 'Ctrl+Z / Ctrl+Shift+Z'],
  ['Markdown shortcuts', '# heading, - list, 1. list, > quote'],
];

export function Toolbar({ editor, onError }: { editor: Editor; onError: (message: string) => void }) {
  const flat = GROUPS.flat();
  // Re-render only when the set of active marks changes, not on every keystroke.
  const active = useEditorState({ editor, selector: ({ editor: e }) => flat.map((b) => b.isActive(e)) });
  const fileInput = useRef<HTMLInputElement>(null);
  const [inserting, setInserting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Ctrl+K for links (Tiptap has no default binding for it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && editor.isFocused) {
        e.preventDefault();
        promptForLink(editor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  async function insertFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return onError('File is larger than 2 MB.');
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

  let i = 0;
  return (
    <div className="relative border-b border-gray-200 bg-white">
      <div role="toolbar" aria-label="Formatting" className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:thin]">
        {GROUPS.map((group, g) => (
          <div key={g} className="flex shrink-0 items-center gap-0.5 border-r border-gray-200 pr-1 last:border-r-0">
            {group.map((b) => {
              const idx = i++;
              return (
                <button
                  key={b.title}
                  type="button"
                  title={b.title}
                  aria-label={b.title}
                  aria-pressed={active[idx]}
                  onMouseDown={(ev) => ev.preventDefault()} // keep the editor selection
                  onClick={() => b.run(editor)}
                  className={`min-w-8 shrink-0 rounded-md px-2 py-1 text-sm transition hover:bg-gray-100 ${b.className ?? ''} ${
                    active[idx] ? 'bg-blue-100 text-blue-800' : 'text-gray-700'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        ))}
        <button
          type="button"
          disabled={inserting}
          onClick={() => fileInput.current?.click()}
          title="Insert the contents of a .txt, .md or .docx file at the cursor"
          className="ml-1 shrink-0 rounded-md px-2 py-1 text-sm text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
        >
          {inserting ? 'Inserting…' : '⤓ Insert from file'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.docx"
          className="hidden"
          aria-label="Insert from file"
          onChange={(e) => insertFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          aria-expanded={helpOpen}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="ml-auto shrink-0 rounded-full border border-gray-300 px-2 text-xs text-gray-700 hover:bg-gray-100"
        >
          ?
        </button>
      </div>
      {helpOpen && (
        <div className="absolute top-full right-3 z-20 mt-1 w-80 rounded-lg bg-white p-4 text-sm shadow-xl ring-1 ring-gray-200">
          <h3 className="mb-2 font-semibold">Keyboard shortcuts</h3>
          <dl className="space-y-1">
            {SHORTCUTS.map(([what, keys]) => (
              <div key={what} className="flex justify-between gap-4">
                <dt className="text-gray-700">{what}</dt>
                <dd className="text-right font-mono text-xs text-gray-900">{keys}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
