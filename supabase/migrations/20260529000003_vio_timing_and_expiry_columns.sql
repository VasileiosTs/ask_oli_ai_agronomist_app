-- VIO follow-up timing: step 2 (results) now fires 7 days after step 1,
-- giving a total of ~10 days from intervention log before asking about outcomes.
-- No schema changes needed — the Edge Functions carry the new interval.

-- Expiry notification: add columns for Touch 2 (same day) and Touch 3 (post-expiry).
-- expiry_post_warned_at: set when "you're back on Free" email is sent 2 days after expiry.
-- tier_expired_at:       set by expire_promo_tiers() so Touch 3 can query expired users
--                        even after tier_expires_at is cleared.

alter table public.users
  add column if not exists expiry_post_warned_at timestamptz,
  add column if not exists tier_expired_at       timestamptz;

comment on column public.users.expiry_post_warned_at is 'When the post-expiry "you are back on Free" email was sent (2 days after expiry)';
comment on column public.users.tier_expired_at       is 'When expire_promo_tiers() last downgraded this user; used for post-expiry email targeting';

-- Update expire_promo_tiers() to record tier_expired_at and reset post-warn flag.
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
         expiry_post_warned_at  = null,
         tier_expired_at        = now(),
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
