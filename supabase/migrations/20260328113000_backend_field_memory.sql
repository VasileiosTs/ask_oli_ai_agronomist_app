create index if not exists idx_conversations_field_id
on public.conversations (field_id, created_at desc);

create index if not exists idx_memory_snapshots_user_field_created_at
on public.memory_snapshots (user_id, field_id, created_at desc);

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
    limit 3
  ) issue
) recent_issues on true
left join (
  select
    field_id,
    count(*)::integer as crop_count
  from public.crops
  group by field_id
) crop_stats on crop_stats.field_id = f.id
left join (
  select
    field_id,
    count(*)::integer as conversation_count
  from public.conversations
  where field_id is not null
  group by field_id
) conversation_stats on conversation_stats.field_id = f.id;

grant select on public.field_context_view to authenticated;

drop view if exists public.field_activity_view;
create view public.field_activity_view
with (security_invoker = true)
as
select
  m.field_id,
  m.user_id,
  'chat_message'::text as activity_type,
  m.id as activity_id,
  m.conversation_id,
  m.id as message_id,
  null::uuid as intervention_id,
  m.role,
  m.created_at as activity_at,
  coalesce(
    nullif(m.metadata -> 'diagnosis_data' ->> 'problem', ''),
    left(m.content, 280)
  ) as title,
  m.content,
  m.metadata,
  null::text as diagnosis,
  null::text as product_applied,
  null::timestamptz as follow_up_at,
  null::text as outcome
from public.chat_messages m
where m.field_id is not null

union all

select
  i.field_id,
  i.user_id,
  'intervention'::text as activity_type,
  i.id as activity_id,
  linked_message.conversation_id,
  i.message_id as message_id,
  i.id as intervention_id,
  null::text as role,
  coalesce(i.applied_at, i.created_at) as activity_at,
  coalesce(nullif(btrim(i.diagnosis), ''), nullif(btrim(i.problem), ''), 'Intervention') as title,
  coalesce(i.notes, '') as content,
  jsonb_strip_nulls(
    jsonb_build_object(
      'diagnosis', i.diagnosis,
      'problem', i.problem,
      'product_applied', i.product_applied,
      'product', i.product,
      'dosage', i.dosage,
      'application_method', i.application_method,
      'outcome', i.outcome,
      'outcome_score', i.outcome_score,
      'follow_up_at', i.follow_up_at,
      'date', i.date
    )
  ) as metadata,
  coalesce(i.diagnosis, i.problem) as diagnosis,
  coalesce(i.product_applied, i.product) as product_applied,
  i.follow_up_at,
  i.outcome
from public.interventions i
left join public.chat_messages linked_message
  on linked_message.id = i.message_id
where i.field_id is not null;

grant select on public.field_activity_view to authenticated;
