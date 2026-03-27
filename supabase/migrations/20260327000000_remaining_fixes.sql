-- Add last_pushed_at column for per-user push rate limiting (#46)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_pushed_at timestamptz;
