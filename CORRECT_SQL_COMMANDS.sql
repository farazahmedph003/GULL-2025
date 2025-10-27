-- CORRECTED SQL COMMANDS FOR SUPABASE REALTIME
-- Run this in Supabase SQL Editor

-- Enable realtime for all tables (WITHOUT "IF NOT EXISTS")
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE balance_history;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_deductions;

-- Verify it worked:
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

