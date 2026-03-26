-- Reset message counts for all users (one-time cleanup after testing)
UPDATE users SET message_count_month = 0, message_reset_date = NOW();
