# Troubleshooting Admin Features

## Issues Reported
1. ❌ Admin deduction system not working
2. ❌ User delete not working

## Step-by-Step Fix

### Step 1: Verify Database Connection

1. Open your browser console (F12)
2. Navigate to any admin page
3. Check for Supabase initialization logs:
   ```
   🔧 Supabase configuration: {
     url: "your-url",
     hasAnonKey: true,
     hasServiceKey: true,
     ...
   }
   ```

**Expected**: All values should be `true`
**If false**: Check your `.env` or `.env.local` file

### Step 2: Apply Database Migration

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase Project Dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query
4. Copy and paste the contents of `MANUAL_MIGRATION_FIX.sql`
5. Click "Run" or press `Ctrl+Enter`
6. Verify success message

**Option B: Using Supabase CLI**
```bash
# If you have Supabase CLI installed
npx supabase db push
```

### Step 3: Verify Tables Exist

Run this query in Supabase SQL Editor:
```sql
SELECT table_name, 
       (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('app_users', 'transactions', 'admin_deductions', 'balance_history')
ORDER BY table_name;
```

**Expected Result:**
- `admin_deductions` - 8 columns ✅
- `app_users` - should exist ✅
- `transactions` - should exist ✅
- `balance_history` - should exist ✅

### Step 4: Verify RLS Policies

Run this query:
```sql
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'admin_deductions' 
  AND schemaname = 'public'
ORDER BY policyname;
```

**Expected Result:** At least 5 policies:
1. `service_role_all_access` - ALL - service_role
2. `authenticated_users_select` - SELECT - authenticated
3. `authenticated_users_insert` - INSERT - authenticated
4. `authenticated_users_update` - UPDATE - authenticated
5. `authenticated_users_delete` - DELETE - authenticated

### Step 5: Test Admin Deduction System

#### Test in Browser Console:
```javascript
// 1. Navigate to any admin page (e.g., /admin/open)
// 2. Open browser console (F12)
// 3. Run this test:

// Get the database service
const { db } = await import('./src/services/database');

// Test admin deduction
try {
  // You'll need a real transaction ID from your database
  await db.saveAdminDeduction(
    'test-transaction-id',  // Replace with actual transaction ID
    'test-admin-id',         // Replace with actual admin user ID
    100,                     // deducted_first
    50,                      // deducted_second
    'test',                  // deduction_type
    { test: true }           // metadata
  );
  console.log('✅ Admin deduction saved successfully!');
} catch (error) {
  console.error('❌ Error:', error);
  console.error('Error details:', {
    message: error.message,
    hint: error.hint,
    details: error.details,
    code: error.code
  });
}
```

### Step 6: Test User Delete

#### Test in Browser Console:
```javascript
// 1. Navigate to /admin/users
// 2. Open browser console (F12)
// 3. Run this test:

const { db } = await import('./src/services/database');

// Test user delete (soft delete)
try {
  // Replace with a test user ID
  await db.deleteUser('test-user-id', false);
  console.log('✅ User soft delete successful!');
} catch (error) {
  console.error('❌ Error:', error);
}
```

### Step 7: Test Reset User History

```javascript
const { db } = await import('./src/services/database');

try {
  const result = await db.resetUserHistory('test-user-id');
  console.log('✅ Reset successful!', result);
} catch (error) {
  console.error('❌ Error:', error);
}
```

## Common Errors & Solutions

### Error: "relation 'admin_deductions' does not exist"
**Solution**: Run the `MANUAL_MIGRATION_FIX.sql` in Supabase SQL Editor

### Error: "permission denied for table admin_deductions"
**Solution**: Check RLS policies. Run Step 4 verification.

### Error: "insert or update on table violates foreign key constraint"
**Solution**: The transaction_id doesn't exist. Ensure you're using valid transaction IDs.

### Error: "JWT expired" or "Invalid JWT"
**Solution**: 
1. Logout and login again
2. Clear browser cache
3. Check if your Supabase service key is correct

### Error: "Database not available"
**Solution**: 
1. Check `.env` file has correct Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_SUPABASE_SERVICE_KEY=your-service-key
   ```
2. Restart development server: `npm run dev`

### User delete button does nothing
**Possible causes:**
1. **Browser confirmation canceled**: Make sure to click "OK" on both confirmation dialogs
2. **Network error**: Check browser console for errors
3. **Permissions**: Ensure logged in as admin

### Admin deductions not showing in UI
**Possible causes:**
1. **Not using admin view**: Ensure you're passing `adminView: true` to `getAllEntriesByType()`
2. **No deductions exist**: Create some deductions first using filter save
3. **Cache issue**: Hard refresh page (Ctrl+Shift+R)

## Manual Testing Checklist

### Admin Deductions:
- [ ] Navigate to Admin Filter Page
- [ ] Apply a filter
- [ ] Click "Save Filter"
- [ ] Verify "admin deductions created" success message
- [ ] Refresh page
- [ ] Verify amounts are deducted in admin view only

### User Delete:
- [ ] Navigate to User Management
- [ ] Find a test user
- [ ] Click delete button
- [ ] Confirm first dialog
- [ ] Confirm second dialog
- [ ] Verify success message
- [ ] Verify user is marked inactive or removed

### Reset User History:
- [ ] Navigate to User Management
- [ ] Find a user with entries
- [ ] Click "Reset History" button
- [ ] Confirm first dialog (shows warning)
- [ ] Confirm second dialog (shows entry count)
- [ ] Verify success message shows deleted count
- [ ] Verify user's entry count is now 0

## Debug Mode

To enable detailed logging, add this to your browser console:
```javascript
localStorage.setItem('debug', 'true');
// Refresh page
```

To disable:
```javascript
localStorage.removeItem('debug');
```

## Still Not Working?

1. **Export browser console logs**:
   - Right-click in console
   - Click "Save as..."
   - Share the log file

2. **Export Supabase logs**:
   - Go to Supabase Dashboard
   - Click "Logs" in sidebar
   - Filter by "Postgres"
   - Look for errors related to `admin_deductions` or `app_users`

3. **Check environment variables**:
   ```javascript
   // Run in browser console
   console.log({
     hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
     hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
     hasServiceKey: !!import.meta.env.VITE_SUPABASE_SERVICE_KEY,
   });
   ```

4. **Verify you're an admin**:
   ```javascript
   // Run in browser console
   import { useAuth } from './src/contexts/AuthContext';
   const { user } = useAuth();
   console.log('User:', user);
   console.log('Is Admin:', user?.is_admin);
   ```

## Quick Fix Commands

### Reset everything and start fresh:
```sql
-- ⚠️ CAUTION: This will delete all admin deductions!
DROP TABLE IF EXISTS public.admin_deductions CASCADE;

-- Then run MANUAL_MIGRATION_FIX.sql again
```

### View all admin deductions:
```sql
SELECT * FROM public.admin_deductions ORDER BY created_at DESC LIMIT 10;
```

### View all users:
```sql
SELECT id, username, full_name, email, is_active, deleted_at 
FROM public.app_users 
ORDER BY created_at DESC;
```

### Count transactions per user:
```sql
SELECT 
  u.username,
  COUNT(t.id) as transaction_count
FROM public.app_users u
LEFT JOIN public.transactions t ON t.user_id = u.id
GROUP BY u.id, u.username
ORDER BY transaction_count DESC;
```

## Contact Support

If none of the above works, please provide:
1. Browser console logs (screenshot or export)
2. Supabase project ID
3. Which specific feature is not working
4. Error messages received
5. Steps you've already tried

