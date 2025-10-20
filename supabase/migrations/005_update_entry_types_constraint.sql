-- Update entryTypes constraint to include new entry types
-- Migration: 005 - Update entryTypes constraint for open and packet

-- Drop the existing constraint
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_entry_types_check;

-- Add new constraint that includes all entry types
ALTER TABLE public.projects 
ADD CONSTRAINT projects_entry_types_check 
CHECK (entry_types <@ ARRAY['open', 'akra', 'ring', 'packet']);

-- Update comment to reflect new entry types
COMMENT ON COLUMN public.projects.entry_types IS 'Array of entry types supported by this project (open, akra, ring, packet)';
