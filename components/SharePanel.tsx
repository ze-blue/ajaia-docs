'use client';

import { useCallback, useEffect, useState } from 'react';

type Share = { user_id: string; name: string; email: string; role: 'viewer' | 'editor' };

export function SharePanel({ docId, isOwner, onClose }: { docId: string; isOwner: boolean; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('editor');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${docId}/shares`);
    const body = await res.json();
    if (res.ok) setShares(body.shares);
    else setError(body.error);
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/30 pt-24" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-title" className="text-lg font-semibold">
          Share document
        </h2>

        {isOwner ? (
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await call('POST', { email, role })) setEmail('');
            }}
          >
            <input
              type="email"
              required
              placeholder="bob@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email to share with"
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              aria-label="Access level"
              className="rounded border border-gray-300 px-2 text-sm"
            >
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button disabled={busy} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
              Share
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-gray-600">Only the owner can change who has access.</p>
        )}
        {isOwner && (
          <p className="mt-2 text-xs text-gray-500">Demo users: alice@example.com, bob@example.com, carol@example.com</p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <h3 className="mt-6 text-sm font-medium text-gray-700">People with access</h3>
        <ul className="mt-2 divide-y divide-gray-100">
          {shares === null && <li className="py-2 text-sm text-gray-500">Loading…</li>}
          {shares?.length === 0 && <li className="py-2 text-sm text-gray-500">Only the owner so far.</li>}
          {shares?.map((s) => (
            <li key={s.user_id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {s.name} <span className="text-gray-500">({s.email})</span>
              </span>
              <span className="flex items-center gap-3">
                {isOwner ? (
                  <select
                    value={s.role}
                    disabled={busy}
                    onChange={(e) => call('POST', { email: s.email, role: e.target.value })}
                    aria-label={`Access level for ${s.name}`}
                    className="rounded border border-gray-200 px-1 text-xs"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className="text-gray-500">{s.role}</span>
                )}
                {isOwner && (
                  <button
                    disabled={busy}
                    onClick={() => call('DELETE', { userId: s.user_id })}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 text-right">
          <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
