import { describe, expect, it } from 'vitest';
import { formatRelative } from '@/components/RelativeTime';
import { toSnippet } from '@/lib/documents';

describe('toSnippet (document list preview)', () => {
  it('decodes entities and collapses whitespace left by stripped tags', () => {
    expect(toSnippet('  Q&amp;A   for  &lt;team&gt;\n\n next ')).toBe('Q&A for <team> next');
  });
  it('truncates long text with an ellipsis', () => {
    const s = toSnippet('word '.repeat(100), 20);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(21);
  });
  it('returns empty string for empty documents', () => {
    expect(toSnippet('   ')).toBe('');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString();
  it('says "just now" for very recent edits', () => {
    expect(formatRelative(ago(10), now)).toBe('just now');
  });
  it('uses minutes, hours and days', () => {
    expect(formatRelative(ago(5 * 60), now)).toMatch(/5 minutes ago/);
    expect(formatRelative(ago(3 * 3600), now)).toMatch(/3 hours ago/);
    expect(formatRelative(ago(2 * 86400), now)).toMatch(/2 days ago/);
  });
  it('falls back to a date after a week', () => {
    expect(formatRelative(ago(30 * 86400), now)).not.toMatch(/ago/);
  });
});
