import mammoth from 'mammoth';
import { marked } from 'marked';
import { AppError } from './errors';
import { sanitizeDocumentHtml } from './sanitize';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB
export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'] as const;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text: blank lines separate paragraphs, single newlines become line breaks. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false, gfm: true }) as string;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').trim();
  return (base || 'Imported document').slice(0, 200);
}

/** Converts an uploaded file into sanitized editor HTML. Throws AppError(400/413) on bad input. */
export async function fileToHtml(filename: string, bytes: Buffer): Promise<string> {
  if (bytes.length === 0) throw new AppError(400, 'The file is empty.');
  if (bytes.length > MAX_IMPORT_BYTES) throw new AppError(413, 'File is larger than 2 MB.');

  const ext = extensionOf(filename);
  let html: string;
  switch (ext) {
    case '.txt':
      html = textToHtml(bytes.toString('utf8'));
      break;
    case '.md':
      html = markdownToHtml(bytes.toString('utf8'));
      break;
    case '.docx':
      try {
        html = (await mammoth.convertToHtml({ buffer: bytes })).value;
      } catch {
        throw new AppError(400, 'Could not read that .docx file. Is it a valid Word document?');
      }
      break;
    default:
      throw new AppError(400, `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}.`);
  }

  const clean = sanitizeDocumentHtml(html);
  return clean.trim() ? clean : '<p></p>';
}
