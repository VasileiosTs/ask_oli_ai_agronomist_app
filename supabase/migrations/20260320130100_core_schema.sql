create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_chat_message_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.metadata is null then
    new.metadata = '{}'::jsonb;
  end if;

  if new.image_urls is null then
    new.image_urls = '{}'::text[];
  end if;

  return new;
end;
$$;

create or replace function public.sync_intervention_legacy_columns()
returns trigger
language plpgsql
as $$
begin
  new.problem = coalesce(new.problem, new.diagnosis);
  new.diagnosis = coalesce(new.diagnosis, new.problem);

  new.product = coalesce(new.product, new.product_applied);
  new.product_applied = coalesce(new.product_applied, new.product);

  if new.date is null then
    new.date = coalesce(new.applied_at::date, current_date);
  end if;

  if new.applied_at is null then
    new.applied_at = coalesce(new.date::timestamptz, now());
  end if;

  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  location text,
  location_lat double precision,
  location_lon double precision,
  primary_crop text,
  language text not null default 'el',
  growing_medium text,
  onboarding_complete boolean not null default false,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  message_count_month integer not null default 0 check (message_count_month >= 0),
  message_reset_date timestamptz,
  last_active_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  crop_type text,
  location text,
  size_ha numeric(10, 2),
  soil_type text,
  irrigation_type text,
  growing_medium text check (growing_medium in ('soil', 'hydro', 'container', 'greenhouse')),
  is_active boolean not null default true,
  asked_medium boolean not null default false,
  asked_irrigation boolean not null default false,
  asked_soil boolean not null default false,
  asked_planting boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  grower_id uuid,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  starred boolean not null default false,
  image_urls text[] not null default '{}'::text[],
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  field_id uuid references public.fields(id) on delete set null,
  grower_id uuid,
  crop_type text,
  diagnosis text,
  product_applied text,
  product_category text,
  dosage text,
  application_method text,
  notes text,
  outcome text,
  outcome_score integer check (outcome_score between 1 and 5),
  severity text check (severity in ('low', 'medium', 'high')),
  share_id uuid not null default gen_random_uuid() unique,
  is_shared boolean not null default false,
  share_summary text,
  follow_up_at timestamptz,
  followed_up_at timestamptz,
  applied_at timestamptz not null default now(),
  problem text,
  product text,
  date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  summary text,
  snapshot jsonb not null default '{}'::jsonb,
  source_message_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  name text not null,
  variety text,
  planted_at date,
  location_name text,
  soil_type text,
  status text not null default 'healthy' check (status in ('healthy', 'warning', 'critical')),
  last_diagnosis_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.fields to authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;
grant select, insert, update, delete on table public.interventions to authenticated;
grant select, insert, update, delete on table public.memory_snapshots to authenticated;
grant select, insert, update, delete on table public.crops to authenticated;

alter table public.users enable row level security;
alter table public.fields enable row level security;
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.interventions enable row level security;
alter table public.memory_snapshots enable row level security;
alter table public.crops enable row level security;

drop policy if exists "users_own_users" on public.users;
create policy "users_own_users"
on public.users
for all
to authenticated
using (auth_id = auth.uid())
with check (auth_id = auth.uid());

drop policy if exists "users_own_fields" on public.fields;
create policy "users_own_fields"
on public.fields
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "users_own_conversations" on public.conversations;
create policy "users_own_conversations"
on public.conversations
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "users_own_messages" on public.chat_messages;
create policy "users_own_messages"
on public.chat_messages
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "users_own_interventions" on public.interventions;
create policy "users_own_interventions"
on public.interventions
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "users_own_snapshots" on public.memory_snapshots;
create policy "users_own_snapshots"
on public.memory_snapshots
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "users_own_crops" on public.crops;
create policy "users_own_crops"
on public.crops
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_fields_updated_at on public.fields;
create trigger set_fields_updated_at
before update on public.fields
for each row
execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

drop trigger if exists set_chat_messages_updated_at on public.chat_messages;
create trigger set_chat_messages_updated_at
before update on public.chat_messages
for each row
execute function public.set_updated_at();

drop trigger if exists normalize_chat_messages on public.chat_messages;
create trigger normalize_chat_messages
before insert or update on public.chat_messages
for each row
execute function public.normalize_chat_message_defaults();

drop trigger if exists set_interventions_updated_at on public.interventions;
create trigger set_interventions_updated_at
before update on public.interventions
for each row
execute function public.set_updated_at();

drop trigger if exists sync_intervention_legacy_columns on public.interventions;
create trigger sync_intervention_legacy_columns
before insert or update on public.interventions
for each row
execute function public.sync_intervention_legacy_columns();

drop trigger if exists set_memory_snapshots_updated_at on public.memory_snapshots;
create trigger set_memory_snapshots_updated_at
before update on public.memory_snapshots
for each row
execute function public.set_updated_at();

drop trigger if exists set_crops_updated_at on public.crops;
create trigger set_crops_updated_at
before update on public.crops
for each row
execute function public.set_updated_at();
