-- Add the demo agronomist as cooperative member (using correct email)
DO $$
DECLARE
  v_coop_id uuid := '36c1b594-db8f-4696-9bd6-214b6bb1c1f5';
  v_agro_user_id uuid;
BEGIN
  -- Get the demo agronomist user's public.users id (note: correct email is demo_oli_agronomist1)
  SELECT u.id INTO v_agro_user_id
  FROM public.users u
  JOIN auth.users au ON au.id = u.auth_id
  WHERE au.email = 'demo_oli_agronomist1@yopmail.com'
  LIMIT 1;

  IF v_agro_user_id IS NULL THEN
    RAISE NOTICE 'Demo agronomist user not found';
    RETURN;
  END IF;

  INSERT INTO public.cooperative_members (cooperative_id, user_id, role)
  VALUES (v_coop_id, v_agro_user_id, 'agronomist')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Added agronomist % to cooperative', v_agro_user_id;
END;
$$;
