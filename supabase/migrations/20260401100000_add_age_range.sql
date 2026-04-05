-- Add age_range demographic field to users table.
-- Optional — NULL means user skipped or onboarded before this field existed.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age_range TEXT;
