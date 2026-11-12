// Data access for documents and shares. Every function takes the acting user and
// enforces access itself, so route handlers cannot accidentally skip a check.

import { canDelete, canEdit, canShare, resolveRole, type Role, type ShareRole } from './access';
import type { User } from './auth';
import { q } from './db';
import { AppError, forbidden, notFound } from './errors';
import { sanitizeDocumentHtml } from './sanitize';

export type DocSummary = {
  id: string;
  title: string;
  updated_at: string;
  owner_name: string;
  role: Role;
};

export type Doc = {
  id: string;
  title: string;
  content: string;
  version: number;
  owner_id: string;
  owner_name: string;
  updated_at: string;
  role: Role;
};

export type Share = { user_id: string; name: string; email: string; role: ShareRole };

export async function listDocuments(user: User): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  const rows = await q<DocSummary>(
    `select d.id, d.title, d.updated_at, u.name as owner_name,
            case when d.owner_id = $1 then 'owner' else s.role end as role
       from documents d
       join users u on u.id = d.owner_id
       left join document_shares s on s.document_id = d.id and s.user_id = $1
      where d.owner_id = $1 or s.user_id = $1
      order by d.updated_at desc`,
    [user.id],
  );
  return {
    owned: rows.filter((r) => r.role === 'owner'),
    shared: rows.filter((r) => r.role !== 'owner'),
  };
}

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Returns the document with the user's role, or throws 404 (also for no access, to avoid leaking existence). */
export async function getDocument(user: User, id: string): Promise<Doc> {
  if (!isUuid(id)) throw notFound();
  const [row] = await q<Omit<Doc, 'role'> & { share_role: string | null }>(
    `select d.id, d.title, d.content, d.version, d.owner_id, d.updated_at,
            u.name as owner_name, s.role as share_role
       from documents d
       join users u on u.id = d.owner_id
       left join document_shares s on s.document_id = d.id and s.user_id = $2
      where d.id = $1`,
    [id, user.id],
  );
  if (!row) throw notFound();
  const role = resolveRole(row.owner_id, row.share_role, user.id);
  if (!role) throw notFound();
  const { share_role: _ignored, ...doc } = row;
  return { ...doc, role };
}

export async function createDocument(user: User, title?: string, content = ''): Promise<string> {
  const [row] = await q<{ id: string }>(
    `insert into documents (title, content, owner_id) values ($1, $2, $3) returning id`,
    [title ?? 'Untitled document', sanitizeDocumentHtml(content), user.id],
  );
  return row.id;
}

/**
 * Saves title and/or content. Uses optimistic concurrency: the update only applies if the
 * stored version still equals `baseVersion`, otherwise 409 so the client can tell the user
 * instead of silently overwriting someone else's edits.
 */
export async function updateDocument(
  user: User,
  id: string,
  patch: { title?: string; content?: string; baseVersion: number },
): Promise<{ version: number; updated_at: string }> {
  const doc = await getDocument(user, id);
  if (!canEdit(doc.role)) throw forbidden('You have view-only access to this document.');

  const [row] = await q<{ version: number; updated_at: string }>(
    `update documents
        set title = coalesce($3, title),
            content = coalesce($4, content),
            version = version + 1,
            updated_at = now()
      where id = $1 and version = $2
      returning version, updated_at`,
    [id, patch.baseVersion, patch.title ?? null, patch.content === undefined ? null : sanitizeDocumentHtml(patch.content)],
  );
  if (!row) {
    throw new AppError(409, 'This document was changed by someone else. Reload to get the latest version.');
  }
  return row;
}

export async function deleteDocument(user: User, id: string): Promise<void> {
  const doc = await getDocument(user, id);
  if (!canDelete(doc.role)) throw forbidden('Only the owner can delete this document.');
  await q('delete from documents where id = $1', [id]);
}

export async function listShares(user: User, id: string): Promise<Share[]> {
  await getDocument(user, id); // any collaborator may see who has access
  return q<Share>(
    `select s.user_id, u.name, u.email, s.role
       from document_shares s join users u on u.id = s.user_id
      where s.document_id = $1
      order by u.name`,
    [id],
  );
}

export async function shareDocument(user: User, id: string, email: string, role: ShareRole): Promise<void> {
  const doc = await getDocument(user, id);
  if (!canShare(doc.role)) throw forbidden('Only the owner can share this document.');

  const [target] = await q<{ id: string }>('select id from users where lower(email) = lower($1)', [email]);
  if (!target) throw new AppError(404, `No user with email ${email}. Try one of the demo accounts.`);
  if (target.id === doc.owner_id) throw new AppError(400, 'The owner already has full access.');

  await q(
    `insert into document_shares (document_id, user_id, role) values ($1, $2, $3)
     on conflict (document_id, user_id) do update set role = excluded.role`,
    [id, target.id, role],
  );
}

export async function revokeShare(user: User, id: string, targetUserId: string): Promise<void> {
  const doc = await getDocument(user, id);
  if (!canShare(doc.role)) throw forbidden('Only the owner can change sharing.');
  await q('delete from document_shares where document_id = $1 and user_id = $2', [id, targetUserId]);
}
