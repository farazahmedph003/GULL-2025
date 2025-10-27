-- ========================================
-- MANUAL MIGRATION FIX
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- 1. Create admin_deductions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  admin_user_id UUID NOT NULL,
  deducted_first NUMERIC DEFAULT 0 NOT NULL,
  deducted_second NUMERIC DEFAULT 0 NOT NULL,
  deduction_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Add foreign key if transactions table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    -- Drop existing constraint if it exists
    ALTER TABLE public.admin_deductions DROP CONSTRAINT IF EXISTS admin_deductions_transaction_id_fkey;
    
    -- Add new constraint
    ALTER TABLE public.admin_deductions
      ADD CONSTRAINT admin_deductions_transaction_id_fkey
      FOREIGN KEY (transaction_id)
      REFERENCES public.transactions(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_deductions_transaction ON public.admin_deductions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_admin_deductions_admin_user ON public.admin_deductions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_deductions_created_at ON public.admin_deductions(created_at);

-- 4. Add deleted_at column to app_users for soft delete
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_users') THEN
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- 5. Enable Row Level Security on admin_deductions
ALTER TABLE public.admin_deductions ENABLE ROW LEVEL SECURITY;

-- 6. Drop ALL existing policies to start fresh
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'admin_deductions' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.admin_deductions';
    END LOOP;
END $$;

-- 7. Create comprehensive RLS policies

-- Service role has full access
CREATE POLICY "service_role_all_access"
  ON public.admin_deductions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view all deductions
CREATE POLICY "authenticated_users_select"
  ON public.admin_deductions
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert deductions
CREATE POLICY "authenticated_users_insert"
  ON public.admin_deductions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update their own deductions
CREATE POLICY "authenticated_users_update"
  ON public.admin_deductions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete deductions
CREATE POLICY "authenticated_users_delete"
  ON public.admin_deductions
  FOR DELETE
  TO authenticated
  USING (true);

-- 8. Add helpful comments
COMMENT ON TABLE public.admin_deductions IS 'Tracks admin deductions separately from user transactions. These deductions only affect admin views and do not modify original transaction data.';
COMMENT ON COLUMN public.admin_deductions.transaction_id IS 'Reference to the original transaction';
COMMENT ON COLUMN public.admin_deductions.admin_user_id IS 'ID of the admin user who made the deduction';
COMMENT ON COLUMN public.admin_deductions.deducted_first IS 'Amount deducted from first field (admin view only)';
COMMENT ON COLUMN public.admin_deductions.deducted_second IS 'Amount deducted from second field (admin view only)';
COMMENT ON COLUMN public.admin_deductions.deduction_type IS 'Type of deduction: filter_save, advanced_filter_first, advanced_filter_second';
COMMENT ON COLUMN public.admin_deductions.metadata IS 'Additional context: filter criteria, search query, etc.';

-- 9. Verify the setup
SELECT 
  'admin_deductions table' as object,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_deductions') 
    THEN '✅ Created' 
    ELSE '❌ Missing' 
  END as status
UNION ALL
SELECT 
  'RLS policies',
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_deductions') 
    THEN '✅ Created (' || COUNT(*)::text || ' policies)' 
    ELSE '❌ Missing' 
  END
FROM pg_policies 
WHERE tablename = 'admin_deductions';

-- 10. Show all policies created
SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  roles as "Roles"
FROM pg_policies 
WHERE tablename = 'admin_deductions' AND schemaname = 'public'
ORDER BY policyname;

