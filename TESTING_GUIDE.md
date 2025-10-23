# Testing Guide - User-Admin System

## Quick Start Testing

### Prerequisites
1. Ensure Supabase is running and connected
2. Database migrations are applied
3. Application is running (`npm run dev`)

---

## 🔐 Test 1: Authentication

### A. Admin Login
1. Navigate to `/welcome`
2. Sign in with admin credentials
3. **Expected**: Redirect to `/admin` (Admin Dashboard)
4. **Verify**: See "ADMIN" badge in header
5. **Verify**: See sidebar with 8 menu items

### B. User Login
1. Log out (if logged in as admin)
2. Navigate to `/welcome`
3. Sign in with regular user credentials
4. **Expected**: Stay on `/` (User Dashboard)
5. **Verify**: No "ADMIN" badge
6. **Verify**: Balance displayed in header
7. **Verify**: No refresh or top-up buttons
8. **Verify**: No sidebar

### C. Sign-Up Removed
1. Navigate to `/welcome`
2. **Verify**: No sign-up form or link visible
3. **Verify**: Only sign-in form is present

---

## 👤 Test 2: User Experience

### A. Entry Creation
1. Log in as regular user
2. Navigate to `UserDashboard`
3. Select "Open" tab
4. Create a new entry with number, first, second amounts
5. **Verify**: Entry appears in history
6. **Verify**: Balance decreases by (first + second)
7. **Verify**: Statistics update correctly
8. Repeat for Akra, Ring, Packet

### B. Entry Management
1. Find an entry you created
2. Click "Edit" (pencil icon)
3. Modify the amounts
4. **Verify**: Entry updates
5. **Verify**: Balance adjusts correctly
6. Click "Delete" (trash icon)
7. **Verify**: Entry is removed
8. **Verify**: Balance refunded

### C. Export/Import
1. Click "Export" button
2. **Verify**: Excel file downloads
3. Add new entry manually in Excel
4. Click "Import" and select modified file
5. **Verify**: New entry appears

### D. Removed Features
1. **Verify**: No undo/redo buttons
2. Try keyboard shortcuts (Ctrl+Z, Ctrl+Y)
3. **Verify**: No undo/redo functionality
4. **Verify**: No "Request Top-up" button
5. **Verify**: No "Refresh" button
6. Try navigating to `/filter` or `/advanced-filter`
7. **Verify**: Access denied or redirected

---

## 👨‍💼 Test 3: Admin Dashboard

### A. System Overview
1. Log in as admin
2. Navigate to `/admin`
3. **Verify**: See system-wide statistics
4. **Verify**: See filter buttons (Open, Akra, Ring, Packet, All)

### B. User Statistics Grid
1. Click "Open" filter
2. **Verify**: Grid shows all users with Open stats
3. **Verify**: Each user box shows:
   - Full name, username
   - Balance
   - Total entries
   - First PKR, Second PKR, Total PKR
   - First Unique, Second Unique
4. Repeat for Akra, Ring, Packet
5. Click "All" filter
6. **Verify**: Combined statistics

---

## 👥 Test 4: User Management

### A. Create New User
1. Navigate to `/admin/users`
2. Click "Create New User" button
3. Fill in form:
   - Full name: "Test User"
   - Username: "testuser"
   - Email: "test@example.com"
   - Password: "testpass123"
   - Initial balance: 1000
4. Submit
5. **Verify**: Success notification
6. **Verify**: New user appears in list
7. Sign out and sign in with new credentials
8. **Verify**: Can access UserDashboard

### B. Top-Up Balance
1. Log in as admin
2. Navigate to `/admin/users`
3. Find a user
4. Click "Top Up" button
5. Enter amount: 500
6. Submit
7. **Verify**: Success notification
8. **Verify**: User's balance increased
9. Click "History" for that user
10. **Verify**: Top-up appears in history

### C. Edit User
1. Click "Edit" button for a user
2. Change full name
3. Change email
4. Submit
5. **Verify**: User details updated
6. Change password
7. **Verify**: User can sign in with new password

### D. View User History
1. Click "History" button for a user
2. **Verify**: Shows mixed list of entries and top-ups
3. **Verify**: Chronological order
4. **Verify**: Top-ups marked with 💰
5. **Verify**: Entries show type, number, amounts

### E. Generate PDF Report
1. Click "PDF" button for a user
2. **Verify**: "Generating..." notification
3. **Verify**: PDF file downloads
4. Open PDF file
5. **Verify**: Contains user information header
6. **Verify**: Contains overall summary
7. **Verify**: Contains separate tables for Open, Akra, Ring, Packet
8. **Verify**: Contains top-up history
9. **Verify**: Professional formatting

### F. System Toggle (Active/Inactive)
1. At top of User Management page, find toggle
2. Click to set "Inactive"
3. **Verify**: Toggle switches
4. **Verify**: Success notification
5. Log in as regular user in different browser/tab
6. Try to add an entry
7. **Verify**: Entry creation is disabled or shows warning
8. Log back in as admin
9. Set toggle back to "Active"
10. **Verify**: Users can now add entries

---

## 📊 Test 5: Admin Entry Pages

### A. Open Entries Page
1. Navigate to `/admin/open`
2. **Verify**: Shows all users' Open entries
3. **Verify**: Each entry shows:
   - User badge (username)
   - Number
   - First, Second amounts
   - Full timestamp
4. **Verify**: Entries color-coded by user
5. Click "Edit" on an entry
6. Modify amounts
7. **Verify**: Entry updates
8. Click "Delete" on an entry
9. **Verify**: Entry removed
10. **Verify**: User's balance refunded

### B. Other Entry Types
1. Repeat Test 5A for:
   - `/admin/akra` (Akra Entries)
   - `/admin/ring` (Ring Entries)
   - `/admin/packet` (Packet Entries)

---

## 🔍 Test 6: Admin Filter Pages

### A. Filter & Calculate
1. Navigate to `/admin/filter`
2. Select "Open" tab
3. **Verify**: Loads all users' Open entries
4. Set First filter: `>= 100`
5. Set First limit: `50`
6. Click "Apply Filter"
7. **Verify**: Results show filtered numbers
8. **Verify**: Results show original and calculated values
9. Click "Copy" on First results
10. **Verify**: Data copied to clipboard
11. Test with other tabs (Akra, Ring, Packet)

### B. Advanced Filter
1. Navigate to `/admin/advanced-filter`
2. Select "Open" tab
3. In First search box, type: `1*`
4. **Verify**: Shows all numbers starting with 1
5. **Verify**: Each result shows user badges
6. Try wildcard: `*3`
7. **Verify**: Shows all numbers ending with 3
8. Try command: `starts:8`
9. **Verify**: Shows numbers starting with 8
10. For Ring tab, try: `middle:5`
11. **Verify**: Shows 3-digit numbers with 5 in middle
12. Click "Copy" on results
13. **Verify**: Data with user attribution copied

---

## 🔒 Test 7: Data Isolation & Security

### A. User Data Isolation
1. Create two test users (User A, User B)
2. Log in as User A
3. Create entries
4. Log out
5. Log in as User B
6. **Verify**: Cannot see User A's entries
7. **Verify**: Can only see own entries
8. **Verify**: Cannot edit/delete User A's entries

### B. Admin Access Control
1. Log in as regular user
2. Try navigating to `/admin`
3. **Verify**: Redirected or access denied
4. Try navigating to `/admin/users`
5. **Verify**: Redirected or access denied
6. Log in as admin
7. **Verify**: Can access all `/admin/*` routes
8. **Verify**: Can see all users' data

### C. Entry Modification Rights
1. Log in as regular user (User A)
2. Create entry
3. **Verify**: Can edit/delete own entry
4. Log in as admin
5. **Verify**: Can edit/delete User A's entry
6. Log in as User A
7. **Verify**: Admin's changes are visible

---

## 🎨 Test 8: UI/UX

### A. Responsive Design
1. Open application on desktop
2. **Verify**: Layout looks good
3. Resize to tablet width
4. **Verify**: Layout adapts
5. Resize to mobile width
6. **Verify**: Layout is mobile-friendly
7. **Verify**: Sidebar on admin closes/opens properly

### B. Dark Mode
1. Toggle dark mode on
2. Navigate through all pages
3. **Verify**: All pages support dark mode
4. **Verify**: Text is readable
5. **Verify**: Colors are appropriate

### C. Notifications
1. Perform various actions (create user, top-up, etc.)
2. **Verify**: Toast notifications appear
3. **Verify**: Success messages are green
4. **Verify**: Error messages are red
5. **Verify**: Notifications auto-dismiss

---

## ✅ Test Completion Checklist

### Authentication ✓
- [ ] Admin login redirects to admin dashboard
- [ ] User login shows UserDashboard
- [ ] Sign-up is removed

### User Experience ✓
- [ ] Entry creation works for all types
- [ ] Entry editing works
- [ ] Entry deletion works
- [ ] Export/Import works
- [ ] Undo/redo removed
- [ ] Top-up request button removed
- [ ] Refresh button removed
- [ ] Balance always visible

### Admin Dashboard ✓
- [ ] System statistics display
- [ ] Filter tabs work
- [ ] User statistics grid accurate

### User Management ✓
- [ ] Create user works
- [ ] Top-up balance works
- [ ] Edit user works
- [ ] View history works
- [ ] PDF generation works
- [ ] System toggle works

### Admin Entry Pages ✓
- [ ] Open entries page works
- [ ] Akra entries page works
- [ ] Ring entries page works
- [ ] Packet entries page works
- [ ] Edit/delete works for all

### Filter Pages ✓
- [ ] Filter & Calculate works
- [ ] Advanced Filter works
- [ ] Tab switching works
- [ ] Copy to clipboard works

### Security ✓
- [ ] Users only see own data
- [ ] Admin sees all data
- [ ] Access control works
- [ ] Role-based routing works

### UI/UX ✓
- [ ] Responsive on all devices
- [ ] Dark mode works
- [ ] Notifications work
- [ ] Sidebar works
- [ ] Loading states work

---

## 🐛 Found Issues?

If you encounter any issues during testing:

1. **Check Browser Console**: Look for errors
2. **Check Network Tab**: Look for failed API calls
3. **Verify Database**: Check if migrations are applied
4. **Check Permissions**: Ensure user has correct role
5. **Clear Cache**: Sometimes helps with state issues

---

## 📝 Notes

- Test with different browsers (Chrome, Firefox, Safari, Edge)
- Test with different screen sizes
- Test with slow network (throttling)
- Test with disabled JavaScript (should show error)
- Test with ad blockers (should work)

---

**Happy Testing!** 🎉

If all tests pass, the system is ready for production deployment.



