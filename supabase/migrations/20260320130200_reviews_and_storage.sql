create table if not exists public.photo_reviews (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null,
  ai_description text,
  ai_diagnosis text,
  ai_confidence numeric,
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed', 'flagged')),
  reviewer_notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.photo_reviews to authenticated;

alter table public.photo_reviews enable row level security;

drop policy if exists "users_own_photo_reviews" on public.photo_reviews;
create policy "users_own_photo_reviews"
on public.photo_reviews
for all
to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat_uploads',
  'chat_uploads',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users_upload_own_chat_files" on storage.objects;
create policy "users_upload_own_chat_files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat_uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_read_own_chat_files" on storage.objects;
create policy "users_read_own_chat_files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat_uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_update_own_chat_files" on storage.objects;
create policy "users_update_own_chat_files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat_uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'chat_uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_delete_own_chat_files" on storage.objects;
create policy "users_delete_own_chat_files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat_uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
