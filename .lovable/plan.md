

## Problem

The invoice PDF shows **wrong Final Payable** because `adapter.ts` and `InvoicePrintView.tsx` recompute financial values with inverted sign logic, instead of passing through the pre-computed values from the tuition edge function.

**Concrete example from the screenshot:**
- Current Month Charges: 1,890,000
- Prior Balance (Debt): -997,500
- Invoice shows Final Payable: 892,500 (wrong — subtracts debt)
- Should show Final Payable: 2,887,500 (adds debt, matching tuition page)
- Outstanding Balance: 2,887,500 (correct, from `carryOutDebt`)

The bug: `InvoicePrintView` line 131 computes `total_due_vnd + paid_to_date_vnd` = `1,890,000 + (-997,500)` = `892,500`. Debt should **increase** payable, not decrease it.

## Fix: Stop all computation, pass through upstream values

### 1. `src/lib/invoice/types.ts`
Add `final_payable_vnd` field to `InvoiceData`. This stores the pre-computed value identical to the tuition page's `finalPayable`.

### 2. `src/lib/invoice/adapter.ts`
Remove all local math (`carryInBalance`, `finalPayable`, `currentCharges` computations). Replace with direct passthrough:
- `total_due_vnd` = `upstream.totalAmount` (already correct)
- `paid_to_date_vnd` = `upstream.carry.carryInCredit` (positive) or `-upstream.carry.carryInDebt` (negative) — display-only, matching user's preference for "debt negative"
- `final_payable_vnd` = `upstream.totalAmount + upstream.carry.carryInDebt - upstream.carry.carryInCredit` — same formula as `useLiveTuitionData.ts` line for `finalPayable`
- `balance_vnd` = `upstream.carry.carryOutDebt` or `-upstream.carry.carryOutCredit` — already fixed
- `recorded_payment_vnd` = `upstream.payments.monthPayments` — already correct

### 3. `src/components/invoice/InvoicePrintView.tsx`
Line 131: Replace computed `invoice.total_due_vnd + invoice.paid_to_date_vnd` with `invoice.final_payable_vnd`.

### Files to modify
- `src/lib/invoice/types.ts` — add 1 field
- `src/lib/invoice/adapter.ts` — remove computation, pure passthrough
- `src/components/invoice/InvoicePrintView.tsx` — use `final_payable_vnd` directly

