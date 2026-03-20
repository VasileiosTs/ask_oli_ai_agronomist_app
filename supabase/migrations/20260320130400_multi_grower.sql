create table if not exists public.growers (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  phone text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.grower_links (
  id uuid primary key default gen_random_uuid(),
  grower_id uuid not null references public.growers(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (grower_id, field_id)
);

grant select, insert, update, delete on table public.growers to authenticated;
grant select, insert, update, delete on table public.grower_links to authenticated;

alter table public.growers enable row level security;
alter table public.grower_links enable row level security;

drop policy if exists "advisor_own_growers" on public.growers;
create policy "advisor_own_growers"
on public.growers
for all
to authenticated
using (advisor_id in (select id from public.users where auth_id = auth.uid()))
with check (advisor_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "advisor_own_grower_links" on public.grower_links;
create policy "advisor_own_grower_links"
on public.grower_links
for all
to authenticated
using (
  grower_id in (
    select g.id
    from public.growers g
    join public.users u on u.id = g.advisor_id
    where u.auth_id = auth.uid()
  )
  and field_id in (
    select f.id
    from public.fields f
    join public.users u on u.id = f.user_id
    where u.auth_id = auth.uid()
  )
)
with check (
  grower_id in (
    select g.id
    from public.growers g
    join public.users u on u.id = g.advisor_id
    where u.auth_id = auth.uid()
  )
  and field_id in (
    select f.id
    from public.fields f
    join public.users u on u.id = f.user_id
    where u.auth_id = auth.uid()
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_chat_messages_grower'
  ) then
    alter table public.chat_messages
      add constraint fk_chat_messages_grower
      foreign key (grower_id)
      references public.growers(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_interventions_grower'
  ) then
    alter table public.interventions
      add constraint fk_interventions_grower
      foreign key (grower_id)
      references public.growers(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_growers_advisor_id on public.growers (advisor_id, created_at desc);
create index if not exists idx_grower_links_grower_id on public.grower_links (grower_id);
create index if not exists idx_grower_links_field_id on public.grower_links (field_id);
create index if not exists idx_chat_messages_grower_id on public.chat_messages (grower_id);
create index if not exists idx_interventions_grower_id on public.interventions (grower_id);
