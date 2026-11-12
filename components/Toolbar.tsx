'use client';

import { type Editor, useEditorState } from '@tiptap/react';

type Btn = {
  label: string;
  title: string;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
  className?: string;
};

const BUTTONS: (Btn | 'sep')[] = [
  { label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', title: 'Italic (Ctrl+I)', className: 'italic', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'U', title: 'Underline (Ctrl+U)', className: 'underline', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  'sep',
  { label: 'H1', title: 'Heading 1', isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', title: 'Heading 2', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: 'Heading 3', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '¶', title: 'Normal text', isActive: (e) => e.isActive('paragraph'), run: (e) => e.chain().focus().setParagraph().run() },
  'sep',
  { label: '• List', title: 'Bulleted list', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1. List', title: 'Numbered list', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '❝', title: 'Quote', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
  'sep',
  { label: '↶', title: 'Undo (Ctrl+Z)', isActive: () => false, run: (e) => e.chain().focus().undo().run() },
  { label: '↷', title: 'Redo (Ctrl+Shift+Z)', isActive: () => false, run: (e) => e.chain().focus().redo().run() },
];

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render only when the set of active marks changes, not on every keystroke.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => BUTTONS.map((b) => (b === 'sep' ? false : b.isActive(e))),
  });

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white px-3 py-2">
      {BUTTONS.map((b, i) =>
        b === 'sep' ? (
          <span key={i} className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
        ) : (
          <button
            key={b.title}
            type="button"
            title={b.title}
            aria-label={b.title}
            aria-pressed={active[i]}
            onMouseDown={(ev) => ev.preventDefault()} // keep editor selection
            onClick={() => b.run(editor)}
            className={`min-w-8 rounded px-2 py-1 text-sm hover:bg-gray-100 ${b.className ?? ''} ${
              active[i] ? 'bg-blue-100 text-blue-800' : 'text-gray-700'
            }`}
          >
            {b.label}
          </button>
        ),
      )}
    </div>
  );
}
