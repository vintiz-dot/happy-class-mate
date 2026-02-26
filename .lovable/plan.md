

# Fix: Admin Alerts Using Wrong Payment Field

## Root Cause

`AdminAlerts.tsx` line 40 calculates overdue amount as:
```
total_amount - paid_amount
```

`paid_amount` is a **legacy field** that is no longer updated by the payment system. The real payment tracking uses `recorded_payment`. For Pikachu and Fake Capybara, `paid_amount` is 0 while `recorded_payment` shows full payment — so the alert falsely flags them as overdue.

## Fix

**File: `src/components/admin/AdminAlerts.tsx`**

1. Add `recorded_payment` to the invoice select query (line 32)
2. Change the owed calculation (line 40) to use `carry_out_debt` as the primary indicator of unpaid balance — this is the single source of truth set by the `calculate-tuition` edge function. Fall back to `total_amount - recorded_payment` for invoices that haven't been recalculated yet.

```typescript
// Before (line 32):
.select("student_id, month, total_amount, paid_amount, students:student_id(full_name)")

// After:
.select("student_id, month, total_amount, paid_amount, recorded_payment, carry_out_debt, students:student_id(full_name)")

// Before (line 40):
const owed = (inv.total_amount || 0) - (inv.paid_amount || 0);

// After:
const owed = (inv.carry_out_debt ?? null) !== null
  ? (inv.carry_out_debt || 0)
  : (inv.total_amount || 0) - (inv.recorded_payment || inv.paid_amount || 0);
```

This is a 2-line change. No other files affected.

