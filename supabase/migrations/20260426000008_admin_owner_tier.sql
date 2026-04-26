-- Set app owner (vasileios.tsipas@gmail.com) to enterprise tier with unlimited access.
-- Bypasses the prevent_tier_change and prevent_role_change triggers.

ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;
ALTER TABLE public.users DISABLE TRIGGER trg_prevent_role_change;

UPDATE public.users
SET
  tier = 'enterprise',
  message_count_month = 0,
  message_reset_date = date_trunc('month', now())
WHERE auth_id IN (
  SELECT au.id
  FROM auth.users au
  WHERE au.email = 'vasileios.tsipas@gmail.com'
);

ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;
ALTER TABLE public.users ENABLE TRIGGER trg_prevent_role_change;
