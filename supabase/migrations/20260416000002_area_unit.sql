-- ── Area unit preference per user ────────────────────────────────────────────
-- Stores user's preferred display unit for field area.
-- 'ha' (default), 'stremma' (Greece: 1 ha = 10 stremma), 'acre' (US/UK).
-- DB always stores size_ha in hectares; this is a display-only preference.

alter table public.users
  add column if not exists area_unit varchar(10) not null default 'ha'
  check (area_unit in ('ha', 'stremma', 'acre'));
