-- Fix: demo agronomist account needs tier='agronomist' to get advisor view.
-- The tier field (not role) controls isAdvisorTier() check in the frontend.
-- Also ensure coop admin has enterprise tier (belt+suspenders).

ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;

UPDATE public.users
SET tier = 'agronomist'
WHERE auth_id IN (
  SELECT au.id FROM auth.users au
  WHERE au.email = 'demo_oli_agronomist1@yopmail.com'
);

UPDATE public.users
SET tier = 'enterprise'
WHERE auth_id IN (
  SELECT au.id FROM auth.users au
  WHERE au.email = 'demo_oli_coop1@yopmail.com'
);

ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;
