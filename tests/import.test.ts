import { describe, expect, it } from 'vitest';
import { fileToHtml, textToHtml, titleFromFilename } from '@/lib/import-file';

const buf = (s: string) => Buffer.from(s, 'utf8');

describe('file import', () => {
  it('turns plain text paragraphs into <p> and escapes HTML', () => {
    expect(textToHtml('Hello\nworld\n\n<b>x</b>')).toBe('<p>Hello<br>world</p><p>&lt;b&gt;x&lt;/b&gt;</p>');
  });

  it('converts markdown headings, emphasis and lists', async () => {
    const html = await fileToHtml('notes.md', buf('# Title\n\n**bold** _it_\n\n- a\n- b\n\n1. one'));
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toMatch(/<ul>\s*<li>a<\/li>/);
    expect(html).toContain('<ol>');
  });

  it('strips scripts, event handlers and javascript: links (XSS)', async () => {
    const html = await fileToHtml(
      'evil.md',
      buf('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))'),
    );
    expect(html).not.toMatch(/script|onerror|javascript:/i);
  });

  it('rejects unsupported types, empty files and files over 2 MB', async () => {
    await expect(fileToHtml('a.pdf', buf('x'))).rejects.toMatchObject({ status: 400 });
    await expect(fileToHtml('a.txt', buf(''))).rejects.toMatchObject({ status: 400 });
    await expect(fileToHtml('a.txt', Buffer.alloc(2 * 1024 * 1024 + 1, 97))).rejects.toMatchObject({ status: 413 });
  });

  it('rejects a corrupt .docx with a friendly error', async () => {
    await expect(fileToHtml('broken.docx', buf('not a zip'))).rejects.toMatchObject({ status: 400 });
  });

  it('derives the document title from the filename', () => {
    expect(titleFromFilename('Q3 plan.final.docx')).toBe('Q3 plan.final');
    expect(titleFromFilename('.md')).toBe('Imported document');
  });
});
