-- Add missing columns to interventions for rich share pages
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS cause text,
  ADD COLUMN IF NOT EXISTS organic_treatments text[],
  ADD COLUMN IF NOT EXISTS chemical_treatments text[];

-- Rebuild safe_shared_diagnoses with security_invoker=false so anonymous
-- users (incognito share links) can read shared diagnoses without being
-- blocked by RLS on the underlying interventions table.
DROP VIEW IF EXISTS public.safe_shared_diagnoses;
CREATE VIEW public.safe_shared_diagnoses
WITH (security_invoker = false)
AS
SELECT
  i.id            AS legacy_intervention_id,
  i.share_id,
  i.crop_type,
  i.diagnosis,
  i.problem,
  i.cause,
  i.severity,
  i.product_applied,
  i.product,
  i.dosage,
  i.application_method,
  i.organic_treatments,
  i.chemical_treatments,
  i.share_summary,
  i.applied_at,
  i.date,
  i.created_at
FROM public.interventions i
WHERE i.is_shared = true;

GRANT SELECT ON public.safe_shared_diagnoses TO anon, authenticated;
