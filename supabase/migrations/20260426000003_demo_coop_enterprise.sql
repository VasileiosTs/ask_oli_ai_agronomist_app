-- Set demo cooperative user to enterprise tier for QA testing
UPDATE public.users 
SET tier = 'enterprise',
    role = 'cooperative'
WHERE id IN (
  SELECT u.id FROM public.users u 
  JOIN auth.users au ON au.id = u.id 
  WHERE au.email LIKE 'demo_oli_coop%'
);
