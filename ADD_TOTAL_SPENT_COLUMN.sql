-- ========================================
-- ADD TOTAL_SPENT COLUMN TO APP_USERS
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Add total_spent column to app_users table
ALTER TABLE public.app_users 
ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0 NOT NULL;

-- Update existing users to have 0 spent
UPDATE public.app_users 
SET total_spent = 0 
WHERE total_spent IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_app_users_total_spent ON public.app_users(total_spent);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

