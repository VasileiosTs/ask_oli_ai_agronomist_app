alter table public.users
  drop constraint if exists users_tier_check;

alter table public.users
  add constraint users_tier_check
  check (tier in ('free', 'pro', 'agronomist', 'enterprise'));

create table if not exists public.guest_ratelimit (
  ip_hash text primary key,
  request_count integer not null default 1 check (request_count >= 0),
  last_request timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_ratelimit_expires_at
  on public.guest_ratelimit (expires_at);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  model text not null,
  request_kind text not null default 'chat',
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_user_created_at
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists idx_ai_usage_events_kind_created_at
  on public.ai_usage_events (request_kind, created_at desc);

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  source text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  message text not null,
  fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_operational_events_source_created_at
  on public.operational_events (source, created_at desc);

create index if not exists idx_operational_events_event_type_created_at
  on public.operational_events (event_type, created_at desc);
