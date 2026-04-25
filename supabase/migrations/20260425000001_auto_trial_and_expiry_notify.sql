-- ═══════════════════════════════════════════════════════════════════
-- Auto-trial on signup + expiry notification tracking
-- ───────────────────────────────────────────────────────────────────
-- 1. All new signups get 30 days of Pro automatically (no code needed)
-- 2. Two email warnings: ~5 days out, ~2 days out
-- 3. expire_promo_tiers() extended to cover trial tier_source too
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Expiry notification tracking columns ──────────────────────────────────
alter table public.users
  add column if not exists expiry_warned_at timestamptz,
  add column if not exists expiry_final_warned_at timestamptz;

comment on column public.users.expiry_warned_at       is 'When the "5 days left" expiry warning email was sent';
comment on column public.users.expiry_final_warned_at is 'When the "2 days left" final expiry warning email was sent';

-- ── 2. Auto-trial trigger ────────────────────────────────────────────────────
-- Fires BEFORE INSERT on users so we can modify the row before it lands.
-- Only applies when tier is the default free value — never overrides explicit
-- enterprise or agronomist grants inserted by admins.

create or replace function public.assign_trial_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.tier is null or new.tier = 'free') and new.tier_source is null then
    new.tier            := 'pro';
    new.tier_expires_at := now() + interval '30 days';
    new.tier_source     := 'trial';
  end if;
  return new;
end $$;

drop trigger if exists on_user_created_assign_trial on public.users;
create trigger on_user_created_assign_trial
  before insert on public.users
  for each row
  execute function public.assign_trial_on_signup();

-- ── 3. Extend expire_promo_tiers to cover trials ─────────────────────────────
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
     set tier                   = 'free',
         tier_expires_at        = null,
         tier_source            = null,
         expiry_warned_at       = null,
         expiry_final_warned_at = null,
         updated_at             = now()
   where tier_source in ('promo', 'trial')
     and tier_expires_at is not null
     and tier_expires_at < now();

  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.operational_events(source, event_type, severity, message, metadata)
      values ('promo_expiry_cron', 'tier_downgraded', 'info',
              'Promo/trial tiers expired and downgraded to free',
              jsonb_build_object('count', v_count));
  end if;

  return v_count;
end $$;

-- ── 4. Cron: expiry warning emails (daily 09:00 UTC) ─────────────────────────
-- Calls send-email with mode expiry_warning_cron.
-- The function finds users in the warning windows and sends emails.
-- Separate from expire_promo_tiers (03:00 UTC) so expired users are already
-- cleaned up before we run the notification pass.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('expiry-warning-emails');
  end if;
exception when others then null;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'expiry-warning-emails',
      '0 9 * * *',
      $cron$
      select net.http_post(
        url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body    := '{"mode": "expiry_warning_cron"}'::jsonb
      );
      $cron$
    );
  end if;
end $$;
