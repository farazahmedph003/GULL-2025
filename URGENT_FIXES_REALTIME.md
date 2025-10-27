# URGENT: Real-time Subscription Fixes

## 🚨 CRITICAL: Run These SQL Commands NOW

Your real-time subscriptions are NOT working because the database tables are not enabled for realtime.

### Step 1: Run in Supabase SQL Editor

Go to your Supabase Dashboard → SQL Editor → New Query, then paste and run:

```sql
-- STEP 1: Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS balance_history;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS admin_deductions;

-- STEP 2: Verify realtime is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

**Expected Output:**
You should see 4 rows showing:
- transactions
- app_users  
- balance_history
- admin_deductions

### Step 2: Refresh PostgREST Schema Cache

After running the SQL, go to:
- Supabase Dashboard → Settings → API
- Click "Reload schema cache" button

OR run this SQL:

```sql
NOTIFY pgrst, 'reload schema';
```

## 🔧 Testing Real-time After SQL

1. Open TWO browser tabs:
   - Tab 1: Admin Akra page
   - Tab 2: User Dashboard

2. In Tab 2 (User), make an entry:
   - Number: 00 01 02 03
   - First: 400
   - Click "Add Entry"

3. In Tab 1 (Admin), check console (F12):
   - Should see: `🔴 Real-time update received for Akra:`
   - Should see: `✅ Akra real-time subscription active`
   - Page should update INSTANTLY with 4 separate entries

4. If still not working:
   - Close BOTH tabs completely
   - Open new tabs
   - Try again

## 📊 Why Bulk Entries Work

The StandardEntry component already splits numbers correctly:
- Input: "00 01 02 03" first 400
- Creates: 4 separate transactions
  - Transaction 1: number=00, first=400
  - Transaction 2: number=01, first=400
  - Transaction 3: number=02, first=400
  - Transaction 4: number=03, first=400

Each transaction is saved separately to the database and should trigger real-time updates.

## ⚠️ Common Issues

### Issue 1: "Channel not subscribed"
- **Cause**: Realtime not enabled on tables
- **Fix**: Run the SQL commands above

### Issue 2: "Updates delayed or missing"
- **Cause**: PostgREST schema cache not refreshed
- **Fix**: Reload schema cache in Supabase dashboard

### Issue 3: "Subscription status shows 'CLOSED'"
- **Cause**: Connection issue or auth problem
- **Fix**: 
  1. Check Supabase credentials in .env
  2. Restart development server
  3. Hard refresh browser (Ctrl+Shift+R)

### Issue 4: "Refresh button does nothing"
- **Cause**: Callback not registered (being fixed in code)
- **Fix**: Code update coming

## 🔍 Debug Console Commands

Open browser console (F12) and run:

```javascript
// Check if Supabase client exists
console.log('Supabase client:', window.supabase);

// Check active channels
console.log('Active channels:', supabase?.getChannels());
```

## 📝 Next Steps After Running SQL

1. ✅ Run SQL commands in Supabase
2. ✅ Reload schema cache
3. ✅ Close all browser tabs
4. ✅ Restart dev server (`npm run dev`)
5. ✅ Open new tabs and test
6. ✅ Check console for real-time logs

The code fixes are being applied now...

