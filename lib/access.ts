// Pure access-control rules. Kept free of I/O so they can be unit tested exhaustively.

export type Role = 'owner' | 'editor' | 'viewer';
export type ShareRole = Exclude<Role, 'owner'>;

export function resolveRole(
  ownerId: string,
  shareRole: string | null | undefined,
  userId: string,
): Role | null {
  if (ownerId === userId) return 'owner';
  if (shareRole === 'editor' || shareRole === 'viewer') return shareRole;
  return null;
}

export const canView = (role: Role | null) => role !== null;
export const canEdit = (role: Role | null) => role === 'owner' || role === 'editor';
export const canShare = (role: Role | null) => role === 'owner';
export const canDelete = (role: Role | null) => role === 'owner';
