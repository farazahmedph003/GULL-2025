-- ========================================
-- UPDATE TOTAL_SPENT WITH ACTUAL TRANSACTION DATA
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- 1. Calculate and update total_spent for all users based on their transactions
UPDATE public.app_users
SET total_spent = (
  SELECT COALESCE(SUM(first_amount + second_amount), 0)
  FROM public.transactions
  WHERE transactions.user_id = app_users.id
);

-- 2. Create a function to automatically update total_spent when transactions change
CREATE OR REPLACE FUNCTION update_user_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting a new transaction, add to total_spent
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.app_users
    SET total_spent = total_spent + (NEW.first_amount + NEW.second_amount)
    WHERE id = NEW.user_id;
    RETURN NEW;
  
  -- When deleting a transaction, subtract from total_spent
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.app_users
    SET total_spent = GREATEST(0, total_spent - (OLD.first_amount + OLD.second_amount))
    WHERE id = OLD.user_id;
    RETURN OLD;
  
  -- When updating a transaction, adjust the difference
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.app_users
    SET total_spent = GREATEST(0, total_spent - (OLD.first_amount + OLD.second_amount) + (NEW.first_amount + NEW.second_amount))
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_user_spent ON public.transactions;

-- 4. Create trigger to automatically update total_spent on transaction changes
CREATE TRIGGER trigger_update_user_spent
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_spent();

-- 5. Verify the update
SELECT 
  username, 
  full_name, 
  balance, 
  total_spent,
  (SELECT COUNT(*) FROM transactions WHERE user_id = app_users.id) as entry_count
FROM public.app_users
ORDER BY total_spent DESC;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

