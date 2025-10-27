-- Enable realtime for all relevant tables
-- This migration enables Supabase Realtime for instant updates across the application

-- Add tables to the realtime publication
-- Note: Run this in your Supabase SQL Editor

-- Enable realtime for transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Enable realtime for app_users table
ALTER PUBLICATION supabase_realtime ADD TABLE app_users;

-- Enable realtime for balance_history table
ALTER PUBLICATION supabase_realtime ADD TABLE balance_history;

-- Enable realtime for admin_deductions table
ALTER PUBLICATION supabase_realtime ADD TABLE admin_deductions;

-- Verify realtime is enabled
-- You can check with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

COMMENT ON PUBLICATION supabase_realtime IS 'Realtime publication for instant data synchronization';

