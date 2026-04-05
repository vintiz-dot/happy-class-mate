
## Classroom Economy & Banking Module

### Phase 1: Database Schema
- Add `economy_mode` (boolean) and `points_to_cash_rate` (integer, default 50) to `classes` table
- Add `cash_on_hand` (integer, default 0) to `students` table
- Create `economy_transactions` table: id, student_id, class_id, type (enum: convert_to_cash, spend_cash, deposit_cash), points_impact, cash_impact, status (enum: pending, approved, rejected), processed_by, created_at, note
- RLS: students see own transactions; teachers/TAs of class can manage

### Phase 2: Reset Logic Override
- Update `reset-monthly-leaderboard` edge function: skip classes with `economy_mode = true`
- Update `reset-points` edge function similarly

### Phase 3: Class Settings UI
- Add Economy Mode toggle + conversion rate input to `ClassSettings.tsx`

### Phase 4: Teacher/TA Leaderboard Updates
- Add "Cash" and "Pending" columns to `ClassLeaderboardShared.tsx` (only when economy_mode ON)
- Add inline "Log Spend" button and approve/reject pending requests

### Phase 5: Student Wallet UI
- Create `StudentWallet.tsx` component with cash balance, withdraw/deposit flows
- Add to `StudentDashboard.tsx` as "My Bank" card
- Create `StudentLedger.tsx` - visual transaction history
- Add withdraw modal (points → cash conversion, creates pending transaction)
- Add deposit modal with validation (deposit ≤ lifetime_withdrawn - lifetime_spent)
- Create notification for teacher when student submits withdrawal request

### Files to modify:
- `supabase/migrations/` - new migration
- `src/components/admin/class/ClassSettings.tsx` - economy toggle
- `src/components/shared/ClassLeaderboardShared.tsx` - cash columns + actions
- `src/pages/StudentDashboard.tsx` - wallet section
- `supabase/functions/reset-monthly-leaderboard/index.ts` - economy bypass
- `supabase/functions/reset-points/index.ts` - economy bypass

### New files:
- `src/components/student/StudentWallet.tsx`
- `src/components/student/WithdrawModal.tsx`
- `src/components/student/DepositModal.tsx`
- `src/components/student/StudentLedger.tsx`
- `src/components/shared/EconomyActions.tsx` (teacher inline actions)
