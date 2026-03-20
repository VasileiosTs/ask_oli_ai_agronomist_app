drop view if exists public.safe_shared_diagnoses;
create view public.safe_shared_diagnoses
with (security_invoker = false)
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
