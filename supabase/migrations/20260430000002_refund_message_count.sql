CREATE OR REPLACE FUNCTION public.refund_message_count(
  p_user_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_reset_date timestamptz;
  v_same_month boolean;
  v_new_count int;
BEGIN
  SELECT message_count_month, message_reset_date
    INTO v_count, v_reset_date
    FROM public.users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_same_month := v_reset_date IS NOT NULL
    AND extract(YEAR  FROM v_reset_date AT TIME ZONE 'UTC') = extract(YEAR  FROM p_now AT TIME ZONE 'UTC')
    AND extract(MONTH FROM v_reset_date AT TIME ZONE 'UTC') = extract(MONTH FROM p_now AT TIME ZONE 'UTC');

  IF NOT v_same_month THEN
    RETURN 0;
  END IF;

  v_new_count := GREATEST(coalesce(v_count, 0) - 1, 0);

  UPDATE public.users
     SET message_count_month = v_new_count
   WHERE id = p_user_id;

  RETURN v_new_count;
END;
$$;
