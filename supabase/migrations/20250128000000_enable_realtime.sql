-- Enable realtime for all relevant tables
-- This migration enables Supabase Realtime for instant updates across the application

-- IMPORTANT: If tables are already in the publication, you'll get an error.
-- In that case, just ignore the error or use the DROP TABLE command first.

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE balance_history;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_deductions;

-- Verify realtime is enabled
-- You can check with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

