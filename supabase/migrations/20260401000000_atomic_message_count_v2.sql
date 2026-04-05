-- v2: move the free-tier limit check INSIDE the locked transaction so the
-- quota check and increment are fully atomic. Returns -1 if limit exceeded
-- (without incrementing), or the new count if allowed.

CREATE OR REPLACE FUNCTION public.increment_message_count(
  p_user_id uuid,
  p_now timestamptz DEFAULT now(),
  p_limit int DEFAULT 20
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count      int;
  v_reset_date timestamptz;
  v_same_month boolean;
  v_current    int;
  v_new_count  int;
BEGIN
  -- Lock the row so concurrent requests queue here, not at the app layer
  SELECT message_count_month, message_reset_date
    INTO v_count, v_reset_date
    FROM public.users
   WHERE id = p_user_id
   FOR UPDATE;

  v_same_month := v_reset_date IS NOT NULL
    AND extract(YEAR  FROM v_reset_date AT TIME ZONE 'UTC') = extract(YEAR  FROM p_now AT TIME ZONE 'UTC')
    AND extract(MONTH FROM v_reset_date AT TIME ZONE 'UTC') = extract(MONTH FROM p_now AT TIME ZONE 'UTC');

  v_current := CASE WHEN v_same_month THEN coalesce(v_count, 0) ELSE 0 END;

  -- Limit check is now inside the lock — no TOCTOU race possible
  IF v_current >= p_limit THEN
    RETURN -1;  -- caller should 429
  END IF;

  v_new_count := v_current + 1;

  UPDATE public.users
     SET message_count_month = v_new_count,
         message_reset_date  = p_now
   WHERE id = p_user_id;

  RETURN v_new_count;
END;
$$;
