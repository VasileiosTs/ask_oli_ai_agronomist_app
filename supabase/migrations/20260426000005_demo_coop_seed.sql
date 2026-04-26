-- Create a demo cooperative and assign the demo_coop user as admin
DO $$
DECLARE
  v_coop_id uuid := gen_random_uuid();
  v_coop_user_id uuid;
  v_agro_user_id uuid;
BEGIN
  -- Get the demo coop user's public.users id
  SELECT u.id INTO v_coop_user_id
  FROM public.users u
  JOIN auth.users au ON au.id = u.auth_id
  WHERE au.email = 'demo_oli_coop1@yopmail.com'
  LIMIT 1;

  IF v_coop_user_id IS NULL THEN
    RAISE NOTICE 'Demo coop user not found, skipping';
    RETURN;
  END IF;

  -- Get the demo agronomist user's public.users id
  SELECT u.id INTO v_agro_user_id
  FROM public.users u
  JOIN auth.users au ON au.id = u.auth_id
  WHERE au.email = 'demo_oli_agro1@yopmail.com'
  LIMIT 1;

  -- Create the cooperative
  INSERT INTO public.cooperatives (id, name, created_at)
  VALUES (v_coop_id, 'Αγροτικός Συνεταιρισμός Ολυμπίας', now())
  ON CONFLICT DO NOTHING;

  -- Add coop user as admin
  INSERT INTO public.cooperative_admins (cooperative_id, user_id)
  VALUES (v_coop_id, v_coop_user_id)
  ON CONFLICT DO NOTHING;

  -- Add agronomist as member (if exists)
  IF v_agro_user_id IS NOT NULL THEN
    INSERT INTO public.cooperative_members (cooperative_id, user_id, role)
    VALUES (v_coop_id, v_agro_user_id, 'agronomist')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Demo cooperative seeded: %', v_coop_id;
END;
$$;
