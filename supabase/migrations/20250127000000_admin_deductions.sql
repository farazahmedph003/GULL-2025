-- Create admin_deductions table for tracking admin-only deductions
-- Deductions are stored separately and only affect admin views, not user data

CREATE TABLE IF NOT EXISTS admin_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  deducted_first NUMERIC DEFAULT 0,
  deducted_second NUMERIC DEFAULT 0,
  deduction_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_admin_deductions_transaction ON admin_deductions(transaction_id);
CREATE INDEX idx_admin_deductions_admin_user ON admin_deductions(admin_user_id);

-- Add deleted_at column to app_users for soft delete
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Enable Row Level Security
ALTER TABLE admin_deductions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_deductions
CREATE POLICY "Allow service role all access on admin_deductions"
  ON admin_deductions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE admin_deductions IS 'Tracks admin deductions separately from user transactions. These deductions only affect admin views.';
COMMENT ON COLUMN admin_deductions.transaction_id IS 'Reference to the original transaction';
COMMENT ON COLUMN admin_deductions.admin_user_id IS 'ID of the admin who made the deduction';
COMMENT ON COLUMN admin_deductions.deduction_type IS 'Type: filter_save, advanced_filter_first, advanced_filter_second';
COMMENT ON COLUMN admin_deductions.metadata IS 'Additional context about the deduction (filter criteria, etc.)';

