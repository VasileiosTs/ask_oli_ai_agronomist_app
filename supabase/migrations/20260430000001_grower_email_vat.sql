-- Add email and VAT number to growers (client) table
alter table public.growers add column if not exists email text;
alter table public.growers add column if not exists vat_number text;
