-- ── manual_grants audit table ────────────────────────────────────────────────
-- Records every manual tier grant made from the admin dashboard.
-- Only readable/writable via the service role (grant-tier edge function).
-- Admins can view the log in the dashboard; users cannot access it at all.

create table if not exists public.manual_grants (
  id                  uuid primary key default gen_random_uuid(),
  granted_to_user_id  uuid not null references public.users(id) on delete cascade,
  granted_to_email    text not null,
  granted_by_user_id  uuid not null,           -- admin's auth.users id
  tier                text not null,
  days                integer not null,
  granted_until       timestamptz not null,
  note                text,
  created_at          timestamptz not null default now()
);

-- No RLS policy for users — they cannot see this table at all.
-- Admins read it via the service-role client inside the edge function / admin page.
alter table public.manual_grants enable row level security;

-- Allow service role full access (edge function uses service role)
-- No policies needed — service role bypasses RLS by default.

-- Index for quick lookup by recipient
create index if not exists manual_grants_user_idx on public.manual_grants(granted_to_user_id);
create index if not exists manual_grants_email_idx on public.manual_grants(granted_to_email);
