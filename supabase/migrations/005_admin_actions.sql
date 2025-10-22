-- Admin Actions Audit Logging
-- Migration: 005 - Admin Actions Table

-- ============================================
-- ADMIN ACTIONS TABLE
-- ============================================
CREATE TABLE public.admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'impersonate', 'exit_impersonation', 'create_transaction', 
        'update_transaction', 'delete_transaction', 'bulk_delete_transactions',
        'create_project', 'update_project', 'delete_project',
        'apply_filter', 'top_up_balance', 'deactivate_user', 'activate_user'
    )),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_admin_actions_admin_user_id ON public.admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_target_user_id ON public.admin_actions(target_user_id);
CREATE INDEX idx_admin_actions_action_type ON public.admin_actions(action_type);
CREATE INDEX idx_admin_actions_created_at ON public.admin_actions(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Admin can read all admin actions
CREATE POLICY "admin_read_all_admin_actions"
    ON public.admin_actions FOR SELECT
    TO authenticated
    USING (
        current_user_is_admin()
    );

-- Admin can create admin actions
CREATE POLICY "admin_create_admin_actions"
    ON public.admin_actions FOR INSERT
    TO authenticated
    WITH CHECK (
        current_user_is_admin() AND
        auth.uid() = admin_user_id
    );

-- Grant access
GRANT ALL ON public.admin_actions TO authenticated;

-- Add comment
COMMENT ON TABLE public.admin_actions IS 'Audit log of admin actions for compliance and tracking';
