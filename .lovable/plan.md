
# Intelligent Family Payment System with Cross-Sibling Credit Transfer

## Overview

This plan implements an intelligent background listener that automatically handles family payments across siblings, including:
1. Automatic detection of sibling groups with outstanding balances
2. Smart payment distribution with excess credit transfer between siblings
3. Real-time activity logging visible in the Reports section

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        Admin Finance UI                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Smart Family     │    │ Family Activity  │    │ Live Tuition  │  │
│  │ Payment Modal    │    │ Log (Reports)    │    │ Dashboard     │  │
│  └────────┬─────────┘    └────────┬─────────┘    └───────────────┘  │
└───────────┼────────────────────────┼────────────────────────────────┘
            │                        │
            ▼                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                   Edge Function: smart-family-payment                  │
├───────────────────────────────────────────────────────────────────────┤
│  1. Auto-detect all siblings in family                                 │
│  2. Fetch live balances via calculate-tuition                          │
│  3. Apply payment to highest-debt sibling first (waterfall)            │
│  4. Transfer excess credit to next sibling automatically               │
│  5. Log each allocation step to audit_log with detailed diff           │
│  6. Recalculate tuition for all affected students                      │
└───────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Create New Edge Function: `smart-family-payment`

**File:** `supabase/functions/smart-family-payment/index.ts`

This function enhances the existing `family-payment` logic with:

- **Auto-sibling detection**: When admin enters family ID and amount, automatically identify all active siblings
- **Live balance fetching**: Call `calculate-tuition` for each sibling to get real-time debt
- **Waterfall allocation**: Pay off highest-debt sibling first, then cascade excess to next
- **Credit transfer logic**: If sibling A is fully paid and has excess, automatically reduce sibling B's debt
- **Detailed audit logging**: Each allocation step logged with:
  - `action: "family_payment_allocation"`
  - `diff`: Contains before/after balances, transfer amounts, sibling chain

**Key Algorithm:**
```text
1. Get all active siblings in family
2. For each sibling, fetch live balance (carryOutDebt from calculate-tuition)
3. Sort siblings by debt descending (highest debt first)
4. Waterfall payment:
   - Apply to first sibling until settled
   - If excess, move to next sibling
   - Continue until no money left or all settled
5. For each allocation:
   - Post ledger entries
   - Update invoice
   - Log to audit_log with full context
```

### 2. Create UI Component: `SmartFamilyPaymentModal`

**File:** `src/components/admin/SmartFamilyPaymentModal.tsx`

Enhanced modal that shows:
- Family selector (auto-loads all siblings when family selected)
- Single payment amount input
- Live preview of how payment will be distributed
- Visual waterfall diagram showing allocation flow
- Credit transfer preview (e.g., "₫200,000 excess from Student A → Student B")
- Real-time balance summary

**Key Features:**
- Auto-selects all active siblings by default
- Shows each sibling's current debt from live calculations
- Preview allocation before confirming
- One-click "Settle All" button when payment equals total family debt

### 3. Create Activity Log Component: `FamilyPaymentActivityLog`

**File:** `src/components/admin/FamilyPaymentActivityLog.tsx`

Displays real-time family payment activities:
- Filter by family or date range
- Shows allocation chain visually
- Highlights credit transfers between siblings
- Expandable details showing before/after balances
- Color-coded status (settled = green, partial = yellow, pending = gray)

### 4. Integrate into Reports Tab

**File:** `src/components/admin/tabs/ReportsTab.tsx`

Add new section:
- "Family Payment Activity" card
- Real-time updates via Supabase realtime subscription on `audit_log`
- Filter by month (matches existing month selector)
- Searchable by family name

### 5. Database Migration

Add new audit action types to track:
```sql
-- No schema changes needed, using existing audit_log table
-- Actions to log:
-- 'family_payment_initiated' - When payment starts
-- 'family_payment_allocation' - Each sibling allocation
-- 'credit_transfer' - When excess moves between siblings
-- 'family_payment_completed' - Summary when finished
```

### 6. Update Finance Tab Integration

**File:** `src/components/admin/tabs/FinanceTab.tsx`

- Add "Smart Family Payment" button to toolbar
- Replace or complement existing "Family Payment" modal
- Add quick-action button for families with multiple students

## Technical Details

### Edge Function Logic (smart-family-payment)

```text
Input:
  - familyId: UUID
  - amount: number (total payment)
  - method: string
  - occurredAt: datetime
  - memo?: string

Process:
  1. Validate admin authentication
  2. Fetch all active students with family_id
  3. For each student, invoke calculate-tuition to get carryOutDebt
  4. Sort by debt (highest first for waterfall)
  5. Initialize remaining = amount
  6. For each student (while remaining > 0):
     a. Debt = student's carryOutDebt
     b. Apply = min(debt, remaining)
     c. Post ledger entries (CASH/BANK debit, AR credit)
     d. Update invoice paid_amount
     e. Log audit entry with allocation details
     f. remaining -= apply
     g. If remaining > 0 and debt fully paid, log credit transfer
  7. Handle leftover (voluntary contribution or credit)
  8. Log completion summary

Output:
  - Success response with allocation breakdown
  - Each student's new balance
  - Activity log IDs for tracking
```

### Audit Log Entry Structure

```json
{
  "action": "family_payment_allocation",
  "entity": "family_payment",
  "entity_id": "payment-uuid",
  "diff": {
    "family_id": "uuid",
    "family_name": "Smith",
    "total_payment": 5000000,
    "allocation_order": 1,
    "student": {
      "id": "uuid",
      "name": "Student A",
      "before_debt": 2000000,
      "applied": 2000000,
      "after_debt": 0
    },
    "excess_transferred": 0,
    "remaining_to_allocate": 3000000
  }
}
```

### UI Preview Component

The allocation preview will show:
```text
┌─────────────────────────────────────────────────┐
│ Payment: 5,000,000 ₫                            │
├─────────────────────────────────────────────────┤
│ 1. Student A (debt: 2,000,000 ₫)                │
│    ├─ Apply: 2,000,000 ₫                        │
│    └─ Remaining: 3,000,000 ₫ → transfers to ↓   │
│                                                 │
│ 2. Student B (debt: 2,500,000 ₫)                │
│    ├─ Apply: 2,500,000 ₫                        │
│    └─ Remaining: 500,000 ₫ → transfers to ↓    │
│                                                 │
│ 3. Student C (debt: 300,000 ₫)                  │
│    ├─ Apply: 300,000 ₫                          │
│    └─ Remaining: 200,000 ₫ → Unapplied Cash    │
└─────────────────────────────────────────────────┘
```

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/smart-family-payment/index.ts` | Core edge function with waterfall logic |
| `src/components/admin/SmartFamilyPaymentModal.tsx` | Enhanced payment modal with live preview |
| `src/components/admin/FamilyPaymentActivityLog.tsx` | Real-time activity display component |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/tabs/ReportsTab.tsx` | Add Family Payment Activity section |
| `src/components/admin/tabs/FinanceTab.tsx` | Add Smart Family Payment button |
| `supabase/config.toml` | Add smart-family-payment function config |

## Security Considerations

- Admin-only access (verified via user_roles table)
- Rate limiting on edge function (10 requests/minute per user)
- Input validation with Zod schema
- All financial operations logged to audit_log
- Service role key used for cross-table operations

## Testing Checklist

- [ ] Create payment for family with 2+ siblings
- [ ] Verify waterfall allocation (highest debt first)
- [ ] Test excess credit transfer between siblings
- [ ] Confirm audit log entries are created
- [ ] Check Reports tab shows activity in real-time
- [ ] Test edge cases: single sibling, zero debt, overpayment
