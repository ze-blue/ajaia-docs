import { describe, expect, it } from 'vitest';
import { canDelete, canEdit, canShare, canView, resolveRole } from '@/lib/access';

describe('resolveRole', () => {
  it('owner always wins, even if a share row also exists', () => {
    expect(resolveRole('u1', 'viewer', 'u1')).toBe('owner');
  });
  it('returns the share role for collaborators', () => {
    expect(resolveRole('u1', 'editor', 'u2')).toBe('editor');
    expect(resolveRole('u1', 'viewer', 'u2')).toBe('viewer');
  });
  it('denies users with no share or an unknown role', () => {
    expect(resolveRole('u1', null, 'u2')).toBeNull();
    expect(resolveRole('u1', 'admin', 'u2')).toBeNull();
  });
});

describe('permissions matrix', () => {
  const table = [
    ['owner', true, true, true, true],
    ['editor', true, true, false, false],
    ['viewer', true, false, false, false],
    [null, false, false, false, false],
  ] as const;
  it.each(table)('%s: view=%s edit=%s share=%s delete=%s', (role, v, e, s, d) => {
    expect([canView(role), canEdit(role), canShare(role), canDelete(role)]).toEqual([v, e, s, d]);
  });
});
