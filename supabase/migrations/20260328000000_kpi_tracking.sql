-- ═══════════════════════════════════════════════════════════════════
-- KPI Auto-Tracking: daily snapshots of all investor-relevant metrics
-- ═══════════════════════════════════════════════════════════════════

-- Admin users table (who can view metrics)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;

create policy "admins_read_self"
on public.admin_users for select to authenticated
using (auth_id = auth.uid());

-- KPI snapshots table
create table if not exists public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,

  -- Users
  total_users integer not null default 0,
  new_users_today integer not null default 0,
  new_users_week integer not null default 0,
  new_users_month integer not null default 0,

  -- Active users
  dau integer not null default 0,
  wau integer not null default 0,
  mau integer not null default 0,

  -- Activation & onboarding
  activation_rate_24h numeric(5,2) default 0,       -- % who msg within 24h of signup
  onboarding_completion_rate numeric(5,2) default 0, -- % who completed onboarding

  -- Engagement
  avg_messages_per_active_user numeric(8,2) default 0,
  total_messages_today integer not null default 0,
  total_photos_today integer not null default 0,
  total_conversations integer not null default 0,
  avg_conversations_per_user numeric(8,2) default 0,

  -- VIO funnel
  vio_logged_count integer not null default 0,        -- total interventions ever
  vio_completed_count integer not null default 0,     -- interventions with outcome
  vio_completion_rate numeric(5,2) default 0,

  -- Retention (cohort-based)
  retention_d1 numeric(5,2) default 0,
  retention_d7 numeric(5,2) default 0,
  retention_d30 numeric(5,2) default 0,

  -- Revenue (ready for Stripe)
  paying_users integer not null default 0,
  mrr_cents integer not null default 0,

  -- Churn
  churned_users_30d integer not null default 0,

  -- Feature adoption
  users_with_photos integer not null default 0,
  users_with_fields integer not null default 0,
  users_with_interventions integer not null default 0,
  voice_input_count integer not null default 0,

  -- Feedback
  positive_feedback_count integer not null default 0,
  negative_feedback_count integer not null default 0,

  created_at timestamptz not null default now()
);

create index idx_kpi_snapshots_date on public.kpi_snapshots(snapshot_date desc);

alter table public.kpi_snapshots enable row level security;
grant select on public.kpi_snapshots to authenticated;
grant insert, update on public.kpi_snapshots to service_role;

-- Admins can read KPI snapshots
create policy "admins_read_kpi"
on public.kpi_snapshots for select to authenticated
using (
  auth.uid() in (select auth_id from public.admin_users)
);

-- ═══════════════════════════════════════════════════════════════════
-- PL/pgSQL function: compute all KPIs and insert a snapshot
-- Runs entirely in the database — no edge function needed for compute
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.compute_kpi_snapshot(target_date date default current_date)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
  v_total_users integer;
  v_new_today integer;
  v_new_week integer;
  v_new_month integer;
  v_dau integer;
  v_wau integer;
  v_mau integer;
  v_activation numeric;
  v_onboarding numeric;
  v_avg_msg numeric;
  v_msg_today integer;
  v_photos_today integer;
  v_total_convos integer;
  v_avg_convos numeric;
  v_vio_logged integer;
  v_vio_completed integer;
  v_vio_rate numeric;
  v_ret_d1 numeric;
  v_ret_d7 numeric;
  v_ret_d30 numeric;
  v_paying integer;
  v_mrr integer;
  v_churned integer;
  v_users_photos integer;
  v_users_fields integer;
  v_users_interventions integer;
  v_positive_fb integer;
  v_negative_fb integer;
begin
  -- ── USER COUNTS ──
  select count(*) into v_total_users from users;

  select count(*) into v_new_today
  from users where created_at::date = target_date;

  select count(*) into v_new_week
  from users where created_at >= (target_date - interval '7 days');

  select count(*) into v_new_month
  from users where created_at >= (target_date - interval '30 days');

  -- ── ACTIVE USERS (based on messages sent) ──
  select count(distinct user_id) into v_dau
  from chat_messages where role = 'user' and created_at::date = target_date;

  select count(distinct user_id) into v_wau
  from chat_messages where role = 'user' and created_at >= (target_date - interval '7 days');

  select count(distinct user_id) into v_mau
  from chat_messages where role = 'user' and created_at >= (target_date - interval '30 days');

  -- ── ACTIVATION (% of users who sent first msg within 24h of signup) ──
  select coalesce(
    round(
      100.0 * count(*) filter (
        where exists (
          select 1 from chat_messages cm
          where cm.user_id = u.id
            and cm.role = 'user'
            and cm.created_at <= u.created_at + interval '24 hours'
        )
      ) / nullif(count(*), 0),
      2
    ),
    0
  ) into v_activation
  from users u
  where u.created_at >= (target_date - interval '30 days');

  -- ── ONBOARDING COMPLETION ──
  select coalesce(
    round(100.0 * count(*) filter (where onboarding_complete) / nullif(count(*), 0), 2),
    0
  ) into v_onboarding from users;

  -- ── ENGAGEMENT ──
  select count(*) into v_msg_today
  from chat_messages where role = 'user' and created_at::date = target_date;

  select count(*) into v_photos_today
  from chat_messages
  where role = 'user' and created_at::date = target_date
    and array_length(image_urls, 1) > 0;

  select coalesce(round(v_msg_today::numeric / nullif(v_dau, 0), 2), 0) into v_avg_msg;

  select count(*) into v_total_convos from conversations;

  select coalesce(round(count(*)::numeric / nullif(v_total_users, 0), 2), 0)
  into v_avg_convos from conversations;

  -- ── VIO FUNNEL ──
  select count(*) into v_vio_logged from interventions;

  select count(*) into v_vio_completed
  from interventions where outcome is not null;

  select coalesce(
    round(100.0 * v_vio_completed / nullif(v_vio_logged, 0), 2), 0
  ) into v_vio_rate;

  -- ── RETENTION (cohort-based) ──
  -- D1: of users who signed up 1 day ago, % who sent a message on day 1
  select coalesce(
    round(100.0 * count(*) filter (
      where exists (
        select 1 from chat_messages cm
        where cm.user_id = u.id and cm.role = 'user'
          and cm.created_at::date = u.created_at::date + 1
      )
    ) / nullif(count(*), 0), 2),
    0
  ) into v_ret_d1
  from users u where u.created_at::date = target_date - 1;

  -- D7: of users who signed up 7 days ago, % active on day 7
  select coalesce(
    round(100.0 * count(*) filter (
      where exists (
        select 1 from chat_messages cm
        where cm.user_id = u.id and cm.role = 'user'
          and cm.created_at::date = u.created_at::date + 7
      )
    ) / nullif(count(*), 0), 2),
    0
  ) into v_ret_d7
  from users u where u.created_at::date = target_date - 7;

  -- D30: of users who signed up 30 days ago, % active on day 30
  select coalesce(
    round(100.0 * count(*) filter (
      where exists (
        select 1 from chat_messages cm
        where cm.user_id = u.id and cm.role = 'user'
          and cm.created_at::date = u.created_at::date + 30
      )
    ) / nullif(count(*), 0), 2),
    0
  ) into v_ret_d30
  from users u where u.created_at::date = target_date - 30;

  -- ── REVENUE ──
  select count(*) into v_paying from users where tier = 'pro';
  -- MRR placeholder: count pro users * price (set to 0 until Stripe)
  v_mrr := v_paying * 0; -- Replace 0 with price_cents when Stripe is live

  -- ── CHURN (users active 31-60 days ago but NOT in last 30 days) ──
  select count(*) into v_churned
  from (
    select distinct user_id from chat_messages
    where role = 'user'
      and created_at::date between (target_date - 60) and (target_date - 31)
  ) old_active
  where not exists (
    select 1 from chat_messages cm
    where cm.user_id = old_active.user_id
      and cm.role = 'user'
      and cm.created_at >= (target_date - interval '30 days')
  );

  -- ── FEATURE ADOPTION ──
  select count(distinct user_id) into v_users_photos
  from chat_messages where array_length(image_urls, 1) > 0;

  select count(distinct user_id) into v_users_fields from fields;

  select count(distinct user_id) into v_users_interventions from interventions;

  -- ── FEEDBACK ──
  select
    count(*) filter (where metadata->>'feedback' = 'positive'),
    count(*) filter (where metadata->>'feedback' = 'negative')
  into v_positive_fb, v_negative_fb
  from chat_messages where metadata->>'feedback' is not null;

  -- ── INSERT SNAPSHOT ──
  insert into kpi_snapshots (
    snapshot_date,
    total_users, new_users_today, new_users_week, new_users_month,
    dau, wau, mau,
    activation_rate_24h, onboarding_completion_rate,
    avg_messages_per_active_user, total_messages_today, total_photos_today,
    total_conversations, avg_conversations_per_user,
    vio_logged_count, vio_completed_count, vio_completion_rate,
    retention_d1, retention_d7, retention_d30,
    paying_users, mrr_cents,
    churned_users_30d,
    users_with_photos, users_with_fields, users_with_interventions,
    positive_feedback_count, negative_feedback_count
  ) values (
    target_date,
    v_total_users, v_new_today, v_new_week, v_new_month,
    v_dau, v_wau, v_mau,
    v_activation, v_onboarding,
    v_avg_msg, v_msg_today, v_photos_today,
    v_total_convos, v_avg_convos,
    v_vio_logged, v_vio_completed, v_vio_rate,
    v_ret_d1, v_ret_d7, v_ret_d30,
    v_paying, v_mrr,
    v_churned,
    v_users_photos, v_users_fields, v_users_interventions,
    v_positive_fb, v_negative_fb
  )
  on conflict (snapshot_date) do update set
    total_users = excluded.total_users,
    new_users_today = excluded.new_users_today,
    new_users_week = excluded.new_users_week,
    new_users_month = excluded.new_users_month,
    dau = excluded.dau, wau = excluded.wau, mau = excluded.mau,
    activation_rate_24h = excluded.activation_rate_24h,
    onboarding_completion_rate = excluded.onboarding_completion_rate,
    avg_messages_per_active_user = excluded.avg_messages_per_active_user,
    total_messages_today = excluded.total_messages_today,
    total_photos_today = excluded.total_photos_today,
    total_conversations = excluded.total_conversations,
    avg_conversations_per_user = excluded.avg_conversations_per_user,
    vio_logged_count = excluded.vio_logged_count,
    vio_completed_count = excluded.vio_completed_count,
    vio_completion_rate = excluded.vio_completion_rate,
    retention_d1 = excluded.retention_d1,
    retention_d7 = excluded.retention_d7,
    retention_d30 = excluded.retention_d30,
    paying_users = excluded.paying_users,
    mrr_cents = excluded.mrr_cents,
    churned_users_30d = excluded.churned_users_30d,
    users_with_photos = excluded.users_with_photos,
    users_with_fields = excluded.users_with_fields,
    users_with_interventions = excluded.users_with_interventions,
    positive_feedback_count = excluded.positive_feedback_count,
    negative_feedback_count = excluded.negative_feedback_count,
    created_at = now();

  -- Return the snapshot as JSON
  select to_jsonb(k.*) into result
  from kpi_snapshots k where k.snapshot_date = target_date;

  return result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Daily cron job: compute KPIs at 00:05 UTC every day
-- ═══════════════════════════════════════════════════════════════════

select cron.schedule(
  'daily-kpi-snapshot',
  '5 0 * * *',
  $$select public.compute_kpi_snapshot(current_date)$$
);
