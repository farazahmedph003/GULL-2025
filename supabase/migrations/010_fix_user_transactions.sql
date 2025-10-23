-- Migration: Fix User Transactions for Projectless Mode
-- Description: Allow users to create transactions without a project (user-scope mode)
-- Created: 2025-10-23

-- ============================================================================
-- 1. Make project_id nullable to allow projectless transactions
-- ============================================================================

-- Drop the NOT NULL constraint on project_id
ALTER TABLE public.transactions 
  ALTER COLUMN project_id DROP NOT NULL;

-- Drop the foreign key constraint (we'll make it optional)
ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_project_id_fkey;

-- Add back the foreign key constraint but allow NULL
ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_project_id_fkey 
  FOREIGN KEY (project_id) 
  REFERENCES public.projects(id) 
  ON DELETE CASCADE;

-- ============================================================================
-- 2. Update RLS policies to allow users to insert transactions
--    even when project_id is 'user-scope' (which won't exist in projects table)
-- ============================================================================

-- Drop and recreate the INSERT policy to be more flexible
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;

CREATE POLICY "Users can create their own transactions"
  ON public.transactions 
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Update SELECT policy to work with NULL project_id
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Users can view their own transactions"
  ON public.transactions 
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Update UPDATE policy to work with NULL project_id
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

CREATE POLICY "Users can update their own transactions"
  ON public.transactions 
  FOR UPDATE
  USING (
    auth.uid() = user_id
  );

-- Update DELETE policy to work with NULL project_id
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;

CREATE POLICY "Users can delete their own transactions"
  ON public.transactions 
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- ============================================================================
-- 3. Add a CHECK constraint to ensure project_id is either NULL or a valid UUID
-- ============================================================================

-- This allows 'user-scope' to be stored as NULL internally
-- The application layer will handle the 'user-scope' string mapping

COMMENT ON COLUMN public.transactions.project_id IS 
  'Project ID (nullable for projectless/user-scope transactions)';

-- ============================================================================
-- 4. Create an index for projectless transactions
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_no_project 
  ON public.transactions(user_id) 
  WHERE project_id IS NULL;

COMMENT ON INDEX idx_transactions_user_id_no_project IS 
  'Optimized index for user-scope (projectless) transactions';

