-- Temporarily bypass tier-immutability trigger to set enterprise tier for demo coop user
ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;

UPDATE public.users 
SET tier = 'enterprise'
WHERE auth_id IN (
  SELECT au.id FROM auth.users au 
  WHERE au.email LIKE 'demo_oli_coop%'
);

ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;
