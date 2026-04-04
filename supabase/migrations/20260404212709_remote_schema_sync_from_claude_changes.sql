drop policy "users_own_users" on "public"."users";

alter table "public"."users" drop constraint "users_tier_check";

alter table "public"."users" add column "age_range" text;

alter table "public"."users" add column "message_count_week" integer not null default 0;

alter table "public"."users" add column "message_week_reset" timestamp with time zone;

alter table "public"."users" add column "report_count_month" integer not null default 0;

alter table "public"."users" add column "report_month_reset" timestamp with time zone;

alter table "public"."users" add column "role" text not null default 'farmer'::text;

alter table "public"."users" alter column "notification_followup" set default true;

alter table "public"."users" add constraint "users_role_check" CHECK ((role = ANY (ARRAY['farmer'::text, 'agronomist'::text]))) not valid;

alter table "public"."users" validate constraint "users_role_check";

alter table "public"."users" add constraint "users_tier_check" CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'agronomist'::text, 'enterprise'::text]))) not valid;

alter table "public"."users" validate constraint "users_tier_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.increment_message_count(p_user_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.increment_message_count(p_user_id uuid, p_now timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 20)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

create or replace view "public"."users_profile" as  SELECT id,
    auth_id,
    name,
    location,
    location_lat,
    location_lon,
    primary_crop,
    language,
    growing_medium,
    onboarding_complete,
    tier,
    message_count_month,
    message_reset_date,
    last_active_at,
    notification_followup,
    created_at,
    updated_at
   FROM public.users;



  create policy "users_own_modify"
  on "public"."users"
  as permissive
  for all
  to authenticated
using ((auth_id = auth.uid()))
with check ((auth_id = auth.uid()));



  create policy "users_own_select"
  on "public"."users"
  as permissive
  for select
  to authenticated
using ((auth_id = auth.uid()));



