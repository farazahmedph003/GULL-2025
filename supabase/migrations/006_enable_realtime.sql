-- Enable realtime for push notifications
-- Migration: 006 - Enable Realtime

-- Enable realtime on profiles table for balance changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Enable realtime on transactions table (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Enable realtime on user_preferences table for notification settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;

-- Enable realtime on projects table for admin panel updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- Create more specific realtime subscription setup
-- These will be used by the application to listen for changes

-- Add comment to indicate realtime is enabled
COMMENT ON TABLE public.profiles IS 'Realtime enabled for balance changes and profile updates';
COMMENT ON TABLE public.transactions IS 'Realtime enabled for transaction updates';
COMMENT ON TABLE public.user_preferences IS 'Realtime enabled for preference changes including notifications';
COMMENT ON TABLE public.projects IS 'Realtime enabled for project creation and updates';

-- Ensure RLS policies work with realtime
-- The existing RLS policies will automatically filter realtime events by user_id
