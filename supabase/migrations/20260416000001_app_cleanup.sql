-- ═══════════════════════════════════════════════════════════════════
-- App cleanup: field coords, conversation grower link.
-- Additive, nullable, safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── Field geolocation (for per-field weather) ────────────────────────────
alter table public.fields
  add column if not exists location_lat numeric,
  add column if not exists location_lon numeric;

-- ── Conversations ↔ growers (advisors: which grower does this chat belong to) ──
alter table public.conversations
  add column if not exists grower_id uuid references public.growers(id) on delete set null;

create index if not exists idx_conversations_grower_id
  on public.conversations(grower_id)
  where grower_id is not null;

-- Rebuild field_context_view to expose location_lat/lon so the UI can use
-- field-specific coords for weather without a second round-trip.
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
  f.location_lat,
  f.location_lon,
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
  latest_intervention.last_diagnosis,
  latest_intervention.last_intervention_at,
  coalesce(crop_stats.crop_count, 0) as crop_count,
  coalesce(intervention_stats.intervention_count, 0) as intervention_count,
  coalesce(intervention_stats.pending_follow_up_count, 0) as pending_follow_up_count,
  coalesce(conversation_stats.conversation_count, 0) as conversation_count,
  coalesce(recent_issues.recent_diagnoses, '{}'::text[]) as recent_diagnoses
from public.fields f
left join lateral (
  select
    coalesce(nullif(btrim(i.diagnosis), ''), nullif(btrim(i.problem), '')) as last_diagnosis,
    coalesce(i.applied_at, i.created_at) as last_intervention_at
  from public.interventions i
  where i.field_id = f.id
  order by coalesce(i.applied_at, i.created_at) desc nulls last
  limit 1
) latest_intervention on true
left join lateral (
  select
    count(*)::integer as intervention_count,
    count(*) filter (
      where i.follow_up_at is not null
        and i.outcome is null
    )::integer as pending_follow_up_count
  from public.interventions i
  where i.field_id = f.id
) intervention_stats on true
left join lateral (
  select
    coalesce(
      array_agg(issue.diagnosis order by issue.activity_at desc),
      '{}'::text[]
    ) as recent_diagnoses
  from (
    select
      coalesce(nullif(btrim(i.diagnosis), ''), nullif(btrim(i.problem), '')) as diagnosis,
      coalesce(i.applied_at, i.created_at) as activity_at
    from public.interventions i
    where i.field_id = f.id
      and coalesce(nullif(btrim(i.diagnosis), ''), nullif(btrim(i.problem), '')) is not null
    order by coalesce(i.applied_at, i.created_at) desc nulls last
    limit 5
  ) issue
) recent_issues on true
left join lateral (
  select count(*)::integer as crop_count
  from public.crops c
  where c.field_id = f.id
) crop_stats on true
left join lateral (
  select count(distinct m.conversation_id)::integer as conversation_count
  from public.chat_messages m
  where m.field_id = f.id
) conversation_stats on true;

grant select on public.field_context_view to authenticated;

-- Backfill: for each conversation with no grower_id, take the first non-null
-- grower_id referenced by any of its chat_messages (interventions path).
update public.conversations c
   set grower_id = sub.grower_id
  from (
    select distinct on (m.conversation_id)
           m.conversation_id,
           m.grower_id
      from public.chat_messages m
     where m.grower_id is not null
     order by m.conversation_id, m.created_at asc
  ) sub
 where c.id = sub.conversation_id
   and c.grower_id is null;
