drop view if exists public.messages;

drop index if exists public.idx_chat_messages_embedding_hnsw;
alter table public.chat_messages drop column if exists embedding;

create view public.messages
with (security_invoker = true)
as
select
  id,
  conversation_id,
  user_id,
  field_id,
  grower_id,
  role,
  content,
  metadata,
  starred,
  image_urls,
  created_at,
  updated_at
from public.chat_messages;

grant select, insert, update, delete on public.messages to authenticated;
