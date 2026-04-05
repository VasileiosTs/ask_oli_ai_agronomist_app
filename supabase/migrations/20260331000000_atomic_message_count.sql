-- Atomic message count increment to prevent race conditions
-- where two concurrent requests both read the same count and both pass quota.

CREATE OR REPLACE FUNCTION public.increment_message_count(
  p_user_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_reset_date timestamptz;
  v_same_month boolean;
  v_new_count int;
BEGIN
  -- Lock the row to prevent concurrent reads
  SELECT message_count_month, message_reset_date
    INTO v_count, v_reset_date
    FROM public.users
   WHERE id = p_user_id
   FOR UPDATE;

  v_same_month := v_reset_date IS NOT NULL
    AND extract(YEAR FROM v_reset_date AT TIME ZONE 'UTC') = extract(YEAR FROM p_now AT TIME ZONE 'UTC')
    AND extract(MONTH FROM v_reset_date AT TIME ZONE 'UTC') = extract(MONTH FROM p_now AT TIME ZONE 'UTC');

  IF v_same_month THEN
    v_new_count := coalesce(v_count, 0) + 1;
  ELSE
    v_new_count := 1;
  END IF;

  UPDATE public.users
     SET message_count_month = v_new_count,
         message_reset_date = p_now
   WHERE id = p_user_id;

  RETURN v_new_count;
END;
$$;

-- Fix any legacy VIO step = 0 records that skip follow-up logic
UPDATE public.interventions SET vio_step = 1 WHERE vio_step = 0;
