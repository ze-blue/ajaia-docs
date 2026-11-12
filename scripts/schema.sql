-- Idempotent schema + seed. Run with `npm run db:setup`.

create table if not exists users (
  id    text primary key,
  name  text not null,
  email text unique not null
);

create table if not exists documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Untitled document',
  content    text not null default '',          -- sanitized HTML produced by the Tiptap editor
  owner_id   text not null references users(id),
  version    integer not null default 1,        -- optimistic concurrency: bumped on every save
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_owner_idx on documents(owner_id);

create table if not exists document_shares (
  document_id uuid not null references documents(id) on delete cascade,
  user_id     text not null references users(id),
  role        text not null check (role in ('viewer', 'editor')),
  created_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists document_shares_user_idx on document_shares(user_id);

insert into users (id, name, email) values
  ('u_alice', 'Alice Johnson', 'alice@example.com'),
  ('u_bob',   'Bob Smith',     'bob@example.com'),
  ('u_carol', 'Carol Lee',     'carol@example.com')
on conflict do nothing;
