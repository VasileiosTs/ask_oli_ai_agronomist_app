alter table public.chat_messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists field_id uuid references public.fields(id) on delete set null,
  add column if not exists grower_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists starred boolean not null default false,
  add column if not exists image_urls text[] not null default '{}'::text[],
  add column if not exists embedding extensions.vector(768),
  add column if not exists updated_at timestamptz not null default now();

alter table public.interventions
  add column if not exists field_id uuid references public.fields(id) on delete set null,
  add column if not exists grower_id uuid,
  add column if not exists diagnosis text,
  add column if not exists product_applied text,
  add column if not exists product_category text,
  add column if not exists share_id uuid default gen_random_uuid(),
  add column if not exists share_summary text,
  add column if not exists severity text check (severity in ('low', 'medium', 'high')),
  add column if not exists follow_up_at timestamptz,
  add column if not exists followed_up_at timestamptz,
  add column if not exists applied_at timestamptz default now(),
  add column if not exists problem text,
  add column if not exists product text,
  add column if not exists date date,
  add column if not exists updated_at timestamptz not null default now();

update public.interventions
set product_applied = product
where product_applied is null
  and product is not null;

update public.interventions
set diagnosis = problem
where diagnosis is null
  and problem is not null;

update public.interventions
set applied_at = date::timestamptz
where applied_at is null
  and date is not null;

update public.interventions
set date = applied_at::date
where date is null
  and applied_at is not null;

create unique index if not exists idx_interventions_share_id on public.interventions (share_id);

create index if not exists idx_users_auth_id on public.users (auth_id);
create index if not exists idx_fields_user_id on public.fields (user_id);
create index if not exists idx_fields_is_active on public.fields (user_id, is_active);
create index if not exists idx_conversations_user_id on public.conversations (user_id, created_at desc);
create index if not exists idx_chat_messages_user_id on public.chat_messages (user_id, created_at desc);
create index if not exists idx_chat_messages_conversation_id on public.chat_messages (conversation_id, created_at desc);
create index if not exists idx_chat_messages_field_id on public.chat_messages (field_id, created_at desc);
create index if not exists idx_interventions_user_id on public.interventions (user_id, created_at desc);
create index if not exists idx_interventions_field_id on public.interventions (field_id, applied_at desc);
create index if not exists idx_interventions_follow_up_at on public.interventions (follow_up_at);
create index if not exists idx_photo_reviews_user_id on public.photo_reviews (user_id, created_at desc);
create index if not exists idx_crops_user_id on public.crops (user_id, created_at desc);
create index if not exists idx_crops_field_id on public.crops (field_id, created_at desc);

create index if not exists idx_chat_messages_embedding_hnsw
on public.chat_messages
using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists idx_fields_name_trgm
on public.fields
using gin (name extensions.gin_trgm_ops);

create index if not exists idx_fields_crop_type_trgm
on public.fields
using gin (crop_type extensions.gin_trgm_ops);

drop view if exists public.messages;
create view public.messages
with (security_invoker = true)
as
select
  id,
  conversation_id,
  user_id,
  field_id,
  grower_id,
  role,
  content,
  metadata,
  starred,
  image_urls,
  embedding,
  created_at,
  updated_at
from public.chat_messages;

grant select, insert, update, delete on public.messages to authenticated;

drop view if exists public.field_context_view;
create view public.field_context_view
with (security_invoker = true)
as
select
  f.id,
  f.user_id,
  f.name,
  f.crop_type,
  f.location,
  f.size_ha,
  f.soil_type,
  f.irrigation_type,
  f.growing_medium,
  f.is_active,
  f.asked_medium,
  f.asked_irrigation,
  f.asked_soil,
  f.asked_planting,
  f.notes,
  f.created_at,
  f.updated_at,
  li.diagnosis as last_diagnosis,
  li.applied_at as last_intervention_at,
  coalesce(cc.crop_count, 0) as crop_count
from public.fields f
left join lateral (
  select
    i.diagnosis,
    i.applied_at
  from public.interventions i
  where i.field_id = f.id
  order by i.applied_at desc nulls last, i.created_at desc
  limit 1
) li on true
left join (
  select
    field_id,
    count(*)::integer as crop_count
  from public.crops
  group by field_id
) cc on cc.field_id = f.id;

grant select on public.field_context_view to authenticated;

create or replace function public.resolve_field(p_user_id uuid, p_mention text)
returns table (
  field_id uuid,
  field_name text,
  confidence numeric
)
language sql
stable
set search_path = public, extensions
as $$
  with ranked as (
    select
      f.id as field_id,
      f.name as field_name,
      greatest(
        similarity(coalesce(f.name, ''), coalesce(p_mention, '')),
        similarity(coalesce(f.crop_type, ''), coalesce(p_mention, '')),
        similarity(coalesce(f.location, ''), coalesce(p_mention, ''))
      ) as confidence
    from public.fields f
    where f.user_id = p_user_id
      and nullif(btrim(coalesce(p_mention, '')), '') is not null
  )
  select
    ranked.field_id,
    ranked.field_name,
    round(ranked.confidence::numeric, 4) as confidence
  from ranked
  where ranked.confidence > 0.15
     or ranked.field_name ilike '%' || p_mention || '%'
  order by ranked.confidence desc, ranked.field_name asc
  limit 3;
$$;

grant execute on function public.resolve_field(uuid, text) to authenticated;

drop view if exists public.safe_shared_diagnoses;
create view public.safe_shared_diagnoses
with (security_invoker = true)
as
select
  i.id as legacy_intervention_id,
  i.share_id,
  i.crop_type,
  i.diagnosis,
  i.problem,
  i.product_applied,
  i.product,
  i.product_category,
  i.dosage,
  i.application_method,
  i.share_summary,
  i.severity,
  i.applied_at,
  i.date,
  i.created_at
from public.interventions i
where i.is_shared = true;

grant select on public.safe_shared_diagnoses to anon, authenticated;
