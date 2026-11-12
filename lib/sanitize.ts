import sanitizeHtml from 'sanitize-html';

// Every piece of HTML that reaches the database goes through this allowlist —
// editor saves and file imports alike — so stored content can never carry scripts.
// It mirrors what the editor itself can produce.

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'], ol: ['start'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Imported .docx/.md files may use deeper headings than the editor supports.
    h4: 'h3',
    h5: 'h3',
    h6: 'h3',
  },
};

export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
