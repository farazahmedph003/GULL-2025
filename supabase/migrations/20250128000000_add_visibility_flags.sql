-- Add visibility flags to transactions table
-- This allows entries to be hidden from admin view or user view independently

-- Add hidden_from_admin column (when true, entry is hidden from admin pages but visible to user)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS hidden_from_admin BOOLEAN DEFAULT NULL;

-- Add hidden_from_user column (when true, entry is hidden from user dashboard but visible to admin)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS hidden_from_user BOOLEAN DEFAULT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_hidden_from_admin 
ON public.transactions(hidden_from_admin) 
WHERE hidden_from_admin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_hidden_from_user 
ON public.transactions(hidden_from_user) 
WHERE hidden_from_user IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.transactions.hidden_from_admin IS 'When true, entry is hidden from admin pages (Open/Akra/Ring/Packet) but still visible to user in their dashboard';
COMMENT ON COLUMN public.transactions.hidden_from_user IS 'When true, entry is hidden from user dashboard but still visible to admin in admin pages';

