-- Add entryTypes field to projects table
-- Migration: 003 - Add entryTypes to projects

-- Add entryTypes column to projects table
ALTER TABLE public.projects 
ADD COLUMN entry_types TEXT[] DEFAULT ARRAY['akra', 'ring'];

-- Update existing projects to have default entry types
UPDATE public.projects 
SET entry_types = ARRAY['akra', 'ring'] 
WHERE entry_types IS NULL;

-- Add constraint to ensure entry_types contains valid values
ALTER TABLE public.projects 
ADD CONSTRAINT projects_entry_types_check 
CHECK (entry_types <@ ARRAY['akra', 'ring']);

-- Add comment
COMMENT ON COLUMN public.projects.entry_types IS 'Array of entry types supported by this project (akra, ring)';
