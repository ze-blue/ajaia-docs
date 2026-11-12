'use client';

import { useCallback, useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { Dialog } from './Dialog';

type Share = { user_id: string; name: string; email: string; role: 'viewer' | 'editor' };

export function SharePanel({ docId, isOwner, onClose }: { docId: string; isOwner: boolean; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('editor');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${docId}/shares`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Could not load sharing settings.');
    return body.shares as Share[];
  }, [docId]);

  const refresh = useCallback(() => load().then(setShares), [load]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((s) => !cancelled && setShares(s))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function call(method: 'POST' | 'DELETE', payload: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/shares`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Request failed');
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={isOwner ? 'Share document' : 'People with access'}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Done
        </button>
      }
    >
      {isOwner && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call('POST', { email, role })) setEmail('');
          }}
        >
          <label htmlFor="share-email" className="text-sm font-medium">
            Add someone by email
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="share-email"
              data-autofocus
              type="email"
              required
              placeholder="bob@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email to share with"
              aria-describedby="share-hint"
              className="field min-w-48 flex-1"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              aria-label="Access level"
              className="field w-auto"
            >
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button disabled={busy} className="btn btn-primary">
              Share
            </button>
          </div>
          <p id="share-hint" className="mt-2 text-xs text-muted">
            Demo accounts: alice@example.com, bob@example.com, carol@example.com
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {isOwner && <h3 className="mt-6 text-sm font-medium">People with access</h3>}
      <ul className="mt-1 divide-y divide-line">
        {shares === null && !error && (
          <li className="flex animate-pulse items-center gap-3 py-3" role="status" aria-label="Loading">
            <span className="size-8 rounded-full bg-gray-200" />
            <span className="h-3 w-40 rounded bg-gray-200" />
          </li>
        )}
        {shares?.length === 0 && (
          <li className="py-3 text-sm text-muted">
            {isOwner ? 'Only you. Add someone above to collaborate.' : 'Only the owner and you.'}
          </li>
        )}
        {shares?.map((s) => (
          <li key={s.user_id} className="flex items-center gap-3 py-2.5">
            <Avatar id={s.user_id} name={s.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.name}</span>
              <span className="block truncate text-xs text-muted">{s.email}</span>
            </span>
            {isOwner ? (
              <>
                <select
                  value={s.role}
                  disabled={busy}
                  onChange={(e) => call('POST', { email: s.email, role: e.target.value })}
                  aria-label={`Access level for ${s.name}`}
                  className="field w-auto"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => call('DELETE', { userId: s.user_id })}
                  aria-label={`Remove ${s.name}`}
                  className="btn btn-quiet"
                >
                  Remove
                </button>
              </>
            ) : (
              <span className="text-sm text-muted">{s.role === 'editor' ? 'Can edit' : 'Can view'}</span>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
