drop policy if exists "public_read_shared_interventions" on public.interventions;
revoke select on public.interventions from anon;
