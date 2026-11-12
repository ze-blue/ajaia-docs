// Data access for documents and shares. Every function takes the acting user and
// enforces access itself, so route handlers cannot accidentally skip a check.

import { canDelete, canEdit, canShare, resolveRole, type Role, type ShareRole } from './access';
import type { User } from './auth';
import { type Query, q, withTransaction } from './db';
import { AppError, forbidden, notFound } from './errors';
import { sanitizeDocumentHtml } from './sanitize';
import { MAX_CONTENT_CHARS } from './validation';

export type DocSummary = {
  id: string;
  title: string;
  updated_at: string;
  owner_id: string;
  owner_name: string;
  updated_by_name: string | null;
  share_count: number;
  snippet: string;
  role: Role;
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Plain-text preview from stored HTML (tags already stripped in SQL). */
export function toSnippet(text: string, max = 140): string {
  const plain = text
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

export type Doc = {
  id: string;
  title: string;
  content: string;
  version: number;
  owner_id: string;
  owner_name: string;
  updated_at: string;
  updated_by_name: string | null;
  role: Role;
};

export type Revision = {
  id: string;
  version: number;
  title: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export type Presence = { user_id: string; name: string; role: Role };

export type Share = { user_id: string; name: string; email: string; role: ShareRole };

export async function listDocuments(user: User): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  const raw = await q<DocSummary>(
    `select d.id, d.title, d.updated_at, d.owner_id, u.name as owner_name, ub.name as updated_by_name,
            case when d.owner_id = $1 then 'owner' else s.role end as role,
            (select count(*)::int from document_shares x where x.document_id = d.id) as share_count,
            regexp_replace(left(d.content, 2000), '<[^>]*>', ' ', 'g') as snippet
       from documents d
       join users u on u.id = d.owner_id
       left join users ub on ub.id = d.updated_by
       left join document_shares s on s.document_id = d.id and s.user_id = $1
      where d.owner_id = $1 or s.user_id = $1
      order by d.updated_at desc`,
    [user.id],
  );
  const rows = raw.map((r) => ({ ...r, snippet: toSnippet(r.snippet) }));
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
            u.name as owner_name, ub.name as updated_by_name, s.role as share_role
       from documents d
       join users u on u.id = d.owner_id
       left join users ub on ub.id = d.updated_by
       left join document_shares s on s.document_id = d.id and s.user_id = $2
      where d.id = $1`,
    [id, user.id],
  );
  if (!row) throw notFound();
  const role = resolveRole(row.owner_id, row.share_role, user.id);
  if (!role) throw notFound();
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    version: row.version,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    updated_at: row.updated_at,
    updated_by_name: row.updated_by_name,
    role,
  };
}

export async function createDocument(user: User, title?: string, content = ''): Promise<string> {
  const html = sanitizeDocumentHtml(content);
  if (html.length > MAX_CONTENT_CHARS) {
    throw new AppError(413, 'That file produces a document too large to edit (over 1 MB of text).');
  }
  return withTransaction(async (tx) => {
    const [row] = await tx<{ id: string; title: string; content: string; version: number }>(
      `insert into documents (title, content, owner_id, updated_by)
       values ($1, $2, $3, $3) returning id, title, content, version`,
      [title ?? 'Untitled document', html, user.id],
    );
    await recordRevision(tx, row.id, row.version, row.title, row.content, user.id, true);
    return row.id;
  });
}

/**
 * Saves title and/or content. Uses optimistic concurrency: the update only applies if the
 * stored version still equals `baseVersion`, otherwise 409 so the client can tell the user
 * instead of silently overwriting someone else's edits. The document row and its history
 * entry are written in one transaction, so they can never disagree.
 */
export async function updateDocument(
  user: User,
  id: string,
  patch: { title?: string; content?: string; baseVersion: number },
  opts: { newRevision?: boolean } = {},
): Promise<{ version: number; updated_at: string }> {
  const doc = await getDocument(user, id);
  if (!canEdit(doc.role)) throw forbidden('You have view-only access to this document.');

  return withTransaction(async (tx) => {
    const [row] = await tx<{ version: number; updated_at: string; title: string; content: string }>(
      `update documents
          set title = coalesce($3, title),
              content = coalesce($4, content),
              version = version + 1,
              updated_at = now(),
              updated_by = $5
        where id = $1 and version = $2
        returning version, updated_at, title, content`,
      [
        id,
        patch.baseVersion,
        patch.title ?? null,
        patch.content === undefined ? null : sanitizeDocumentHtml(patch.content),
        user.id,
      ],
    );
    if (!row) {
      throw new AppError(409, 'This document was changed by someone else. Reload to get the latest version.');
    }
    await recordRevision(tx, id, row.version, row.title, row.content, user.id, opts.newRevision ?? false);
    return { version: row.version, updated_at: row.updated_at };
  });
}

// ---------------------------------------------------------------------------
// Version history
// ---------------------------------------------------------------------------

/** Consecutive saves by the same person within this window are coalesced into one revision. */
export const REVISION_WINDOW_SECONDS = 60;

/**
 * Snapshots the document after a save. Autosave fires about once a second while typing, so
 * instead of one row per burst we extend the latest revision if the same author made it within
 * the window, and start a new revision otherwise (different author, a pause, or `forceNew`,
 * which restores use so the state they replace stays in history).
 */
async function recordRevision(
  tx: Query,
  docId: string,
  version: number,
  title: string,
  content: string,
  userId: string,
  forceNew: boolean,
) {
  if (!forceNew) {
    const [latest] = await tx<{ id: string; extend: boolean }>(
      `select id, (created_by = $2 and created_at > now() - make_interval(secs => $3)) as extend
         from document_revisions where document_id = $1
        order by id desc limit 1
        for update`,
      [docId, userId, REVISION_WINDOW_SECONDS],
    );
    if (latest?.extend) {
      await tx(
        `update document_revisions set version = $2, title = $3, content = $4, updated_at = now() where id = $1`,
        [latest.id, version, title, content],
      );
      return;
    }
  }
  await tx(
    `insert into document_revisions (document_id, version, title, content, created_by)
     values ($1, $2, $3, $4, $5)`,
    [docId, version, title, content, userId],
  );
}

export async function listRevisions(user: User, id: string): Promise<Revision[]> {
  await getDocument(user, id);
  return q<Revision>(
    `select r.id::text as id, r.version, r.title, u.name as author_name, r.created_at, r.updated_at
       from document_revisions r join users u on u.id = r.created_by
      where r.document_id = $1
      order by r.id desc
      limit 50`,
    [id],
  );
}

export async function getRevision(
  user: User,
  id: string,
  revisionId: string,
): Promise<Revision & { content: string }> {
  await getDocument(user, id);
  if (!/^\d{1,18}$/.test(revisionId)) throw new AppError(404, 'Revision not found.');
  const [rev] = await q<Revision & { content: string }>(
    `select r.id::text as id, r.version, r.title, r.content, u.name as author_name, r.created_at, r.updated_at
       from document_revisions r join users u on u.id = r.created_by
      where r.document_id = $1 and r.id = $2`,
    [id, revisionId],
  );
  if (!rev) throw new AppError(404, 'Revision not found.');
  return rev;
}

/** Restoring is an ordinary save of old content: permission-checked, version-checked, and itself undoable. */
export async function restoreRevision(user: User, id: string, revisionId: string, baseVersion: number) {
  const rev = await getRevision(user, id, revisionId);
  const saved = await updateDocument(
    user,
    id,
    { title: rev.title, content: rev.content, baseVersion },
    { newRevision: true }, // never fold a restore into the revision it replaces
  );
  return { ...saved, title: rev.title, content: rev.content };
}

// ---------------------------------------------------------------------------
// Presence: who else has the document open (heartbeat polling, no websockets)
// ---------------------------------------------------------------------------

export const PRESENCE_TTL_SECONDS = 20;

/**
 * Records that `user` has the document open, and returns what the client needs to stay in
 * sync: the latest version (to notice saves by others) and who else is currently active.
 */
export async function heartbeat(user: User, id: string) {
  const doc = await getDocument(user, id);
  await q(
    `insert into document_presence (document_id, user_id, last_seen) values ($1, $2, now())
     on conflict (document_id, user_id) do update set last_seen = now()`,
    [id, user.id],
  );
  const others = await q<{ user_id: string; name: string; owner_id: string; share_role: string | null }>(
    `select p.user_id, u.name, d.owner_id, s.role as share_role
       from document_presence p
       join users u on u.id = p.user_id
       join documents d on d.id = p.document_id
       left join document_shares s on s.document_id = p.document_id and s.user_id = p.user_id
      where p.document_id = $1 and p.user_id <> $2
        and p.last_seen > now() - make_interval(secs => $3)
      order by u.name`,
    [id, user.id, PRESENCE_TTL_SECONDS],
  );
  const active = others
    .map((o) => ({ user_id: o.user_id, name: o.name, role: resolveRole(o.owner_id, o.share_role, o.user_id) }))
    .filter((o): o is Presence => o.role !== null); // people whose access was revoked drop off
  return {
    version: doc.version,
    title: doc.title,
    updated_at: doc.updated_at,
    updated_by_name: doc.updated_by_name,
    role: doc.role,
    active,
  };
}

export async function leaveDocument(user: User, id: string) {
  await q('delete from document_presence where document_id = $1 and user_id = $2', [id, user.id]);
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
  if (!target) throw new AppError(404, `No account uses ${email}. Ask them to create one first, then share again.`);
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
