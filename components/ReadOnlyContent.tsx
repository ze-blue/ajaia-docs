'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

/**
 * Renders stored document HTML through a read-only Tiptap editor instead of innerHTML.
 * Content is already sanitized on write; parsing through the editor schema is a second
 * layer that drops anything the editor itself could not have produced.
 */
export function ReadOnlyContent({ html, className }: { html: string; className?: string }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: html,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose prose-slate max-w-none focus:outline-none' } },
  });
  return <EditorContent editor={editor} className={className} />;
}
