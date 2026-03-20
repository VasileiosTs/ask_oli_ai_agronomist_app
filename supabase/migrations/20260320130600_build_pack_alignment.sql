alter table public.users
  add column if not exists notification_weekly_plan boolean not null default false,
  add column if not exists notification_followup boolean not null default false;

alter table public.fields
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'auto_detected'));

