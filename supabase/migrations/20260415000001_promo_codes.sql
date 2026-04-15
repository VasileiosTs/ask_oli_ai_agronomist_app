-- ═══════════════════════════════════════════════════════════════════
-- Promo codes: grant free Pro (or higher) access without Stripe.
-- Used for farmer associations, partner pilots, founder comps.
-- Coexists with future Stripe integration (tier_source distinguishes).
-- ═══════════════════════════════════════════════════════════════════

-- ── Extend users with expiry + source tracking ────────────────────────────
alter table public.users
  add column if not exists tier_expires_at timestamptz,
  add column if not exists tier_source text check (tier_source in ('promo', 'stripe', 'manual', 'trial'));

create index if not exists idx_users_tier_expires_at
  on public.users (tier_expires_at)
  where tier_expires_at is not null;

-- ── Promo codes catalog ──────────────────────────────────────────────────
create table if not exists public.promo_codes (
  code text primary key,
  grants_tier text not null check (grants_tier in ('pro', 'agronomist', 'expert', 'enterprise')),
  duration_days integer not null check (duration_days > 0 and duration_days <= 3650),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemptions_count integer not null default 0,
  expires_at timestamptz,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_promo_codes_is_active on public.promo_codes(is_active) where is_active;

alter table public.promo_codes enable row level security;

-- Admins can do everything. Normal users never read this table directly
-- (they hit the redeem RPC which runs as security definer).
create policy "promo_codes_admin_all"
  on public.promo_codes for all to authenticated
  using (exists (select 1 from public.admin_users a where a.auth_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.auth_id = auth.uid()));

-- ── Redemption history ───────────────────────────────────────────────────
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.promo_codes(code) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  granted_tier text not null,
  granted_until timestamptz not null,
  redeemed_at timestamptz not null default now(),
  unique(code, user_id)
);

create index if not exists idx_promo_redemptions_user on public.promo_redemptions(user_id, redeemed_at desc);
create index if not exists idx_promo_redemptions_code on public.promo_redemptions(code, redeemed_at desc);

alter table public.promo_redemptions enable row level security;

-- Users see their own history; admins see everything
create policy "promo_redemptions_self_read"
  on public.promo_redemptions for select to authenticated
  using (
    user_id in (select id from public.users where auth_id = auth.uid())
    or exists (select 1 from public.admin_users a where a.auth_id = auth.uid())
  );

-- ── Rate limiting: prevent brute-force code guessing ─────────────────────
create table if not exists public.promo_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code_attempted text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_promo_attempts_user_time
  on public.promo_attempts(user_id, attempted_at desc);

alter table public.promo_attempts enable row level security;
-- No policies: table only accessed via RPC (security definer).

-- ── Atomic redemption RPC ────────────────────────────────────────────────
create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_user_id uuid;
  v_normalized text;
  v_code promo_codes%rowtype;
  v_recent_attempts integer;
  v_recent_fails integer;
  v_existing_expiry timestamptz;
  v_current_tier text;
  v_new_expiry timestamptz;
begin
  if v_auth_id is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  select id, tier, tier_expires_at
    into v_user_id, v_current_tier, v_existing_expiry
    from public.users where auth_id = v_auth_id;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  v_normalized := upper(trim(coalesce(p_code, '')));
  if length(v_normalized) < 3 or length(v_normalized) > 40 then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  -- Rate limit: 5 attempts per hour (any outcome), 3 failures per hour
  select count(*) into v_recent_attempts
    from public.promo_attempts
    where user_id = v_user_id and attempted_at > now() - interval '1 hour';

  select count(*) into v_recent_fails
    from public.promo_attempts
    where user_id = v_user_id and success = false and attempted_at > now() - interval '1 hour';

  if v_recent_attempts >= 10 or v_recent_fails >= 5 then
    insert into public.promo_attempts(user_id, code_attempted, success)
      values (v_user_id, v_normalized, false);
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- Lock the code row for update (prevents race on max_redemptions)
  select * into v_code from public.promo_codes where code = v_normalized for update;

  if v_code.code is null or not v_code.is_active then
    insert into public.promo_attempts(user_id, code_attempted, success) values (v_user_id, v_normalized, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    insert into public.promo_attempts(user_id, code_attempted, success) values (v_user_id, v_normalized, false);
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_code.max_redemptions is not null and v_code.redemptions_count >= v_code.max_redemptions then
    insert into public.promo_attempts(user_id, code_attempted, success) values (v_user_id, v_normalized, false);
    return jsonb_build_object('ok', false, 'error', 'exhausted');
  end if;

  if exists (select 1 from public.promo_redemptions where code = v_normalized and user_id = v_user_id) then
    insert into public.promo_attempts(user_id, code_attempted, success) values (v_user_id, v_normalized, false);
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  -- Stacking: extend from max(now, current expiry)
  v_new_expiry := greatest(now(), coalesce(v_existing_expiry, now())) + (v_code.duration_days || ' days')::interval;

  -- Apply grant atomically
  update public.users
     set tier = v_code.grants_tier,
         tier_expires_at = v_new_expiry,
         tier_source = 'promo',
         updated_at = now()
   where id = v_user_id;

  update public.promo_codes
     set redemptions_count = redemptions_count + 1
   where code = v_normalized;

  insert into public.promo_redemptions(code, user_id, granted_tier, granted_until)
    values (v_normalized, v_user_id, v_code.grants_tier, v_new_expiry);

  insert into public.promo_attempts(user_id, code_attempted, success)
    values (v_user_id, v_normalized, true);

  return jsonb_build_object(
    'ok', true,
    'tier', v_code.grants_tier,
    'granted_until', v_new_expiry,
    'duration_days', v_code.duration_days
  );
end $$;

grant execute on function public.redeem_promo_code(text) to authenticated;

-- ── Admin: generate batch of one-time codes ──────────────────────────────
create or replace function public.generate_promo_batch(
  p_prefix text,
  p_count integer,
  p_tier text,
  p_duration_days integer,
  p_expires_at timestamptz default null,
  p_notes text default null
)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_code text;
  i integer;
begin
  select exists (select 1 from public.admin_users where auth_id = auth.uid()) into v_is_admin;
  if not v_is_admin then
    raise exception 'admin_required';
  end if;

  if p_count <= 0 or p_count > 1000 then
    raise exception 'invalid_count';
  end if;

  for i in 1..p_count loop
    -- Prefix + 6 random alphanumeric chars, uppercase. Collision-retry loop.
    loop
      v_code := upper(coalesce(nullif(trim(p_prefix), ''), 'O')) || '-' ||
                upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      begin
        insert into public.promo_codes(code, grants_tier, duration_days, max_redemptions, expires_at, notes, created_by)
          values (v_code, p_tier, p_duration_days, 1, p_expires_at, p_notes, auth.uid());
        exit;
      exception when unique_violation then
        -- retry with a new random suffix
        continue;
      end;
    end loop;
    return next v_code;
  end loop;
end $$;

grant execute on function public.generate_promo_batch(text, integer, text, integer, timestamptz, text) to authenticated;

-- ── Nightly cron: downgrade expired promo tiers ──────────────────────────
-- Users whose promo expiry has passed drop back to free. Stripe-sourced
-- tiers are untouched (Stripe webhooks manage those).
create or replace function public.expire_promo_tiers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.users
     set tier = 'free',
         tier_expires_at = null,
         tier_source = null,
         updated_at = now()
   where tier_source = 'promo'
     and tier_expires_at is not null
     and tier_expires_at < now();
  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.operational_events(source, event_type, severity, message, metadata)
      values ('promo_expiry_cron', 'tier_downgraded', 'info',
              'Promo tiers expired and downgraded', jsonb_build_object('count', v_count));
  end if;

  return v_count;
end $$;

-- Schedule daily at 03:00 UTC
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('expire-promo-tiers');
  end if;
exception when others then null;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-promo-tiers', '0 3 * * *', $cron$select public.expire_promo_tiers();$cron$);
  end if;
end $$;

-- ── Seed launch codes for farmer meetings ────────────────────────────────
insert into public.promo_codes (code, grants_tier, duration_days, max_redemptions, expires_at, notes) values
  ('OLIVE1',   'pro', 30,  500,  now() + interval '180 days', 'Launch: 1 month free Pro'),
  ('OLIVE3',   'pro', 90,  500,  now() + interval '180 days', 'Launch: 3 months free Pro (farmer association)'),
  ('OLIVE6',   'pro', 180, 250,  now() + interval '180 days', 'Launch: 6 months free Pro'),
  ('OLIVE12',  'pro', 365, 100,  now() + interval '180 days', 'Launch: 12 months free Pro'),
  ('FOUNDER',  'pro', 180, null, now() + interval '365 days', 'Founder comps — unlimited redemptions')
on conflict (code) do nothing;
