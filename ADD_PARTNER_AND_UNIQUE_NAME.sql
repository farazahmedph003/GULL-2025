-- Migration: Add is_partner column, unique constraint on full_name, and balance_history table
-- Run this in your Supabase SQL editor

-- 1. Add is_partner column to app_users table (if not exists)
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;

-- 2. Add unique constraint on full_name (case-insensitive)
-- First, create a unique index on lowercase full_name to ensure case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS unique_full_name_lower 
ON app_users (LOWER(full_name));

-- 3. Create balance_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS balance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('top_up', 'withdrawal')),
  balance_after NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on app_user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_balance_history_app_user_id ON balance_history(app_user_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_created_at ON balance_history(created_at DESC);

-- 4. Add comments for documentation
COMMENT ON COLUMN app_users.is_partner IS 'Indicates if the user is marked as a partner';
COMMENT ON TABLE balance_history IS 'Records all balance top-ups and withdrawals for users';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'app_users' 
AND column_name IN ('is_partner', 'full_name');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'balance_history'
ORDER BY ordinal_position;

