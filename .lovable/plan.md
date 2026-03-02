

## Problem

The invoice adapter (`adapter.ts`) recomputes `finalPayable` and `balance_vnd` from raw carry fields using its own formulas, while the tuition page (`useLiveTuitionData.ts`) computes them differently:

- **Tuition page balance**: `carry.carryOutDebt ?? -(carry.carryOutCredit ?? 0)` (uses the backend's final carry-out values)
- **Invoice adapter balance**: `finalPayable - monthPayments` (recomputes from intermediate values)

These formulas can diverge, causing mismatched numbers. The adapter file even says "Pure mapping adapter - no computation" but violates that by doing math.

## Fix

Stop recomputing in the adapter. Pass through the same upstream fields the tuition page uses:

**`src/lib/invoice/adapter.ts`** changes:
- `total_due_vnd` = `upstream.totalAmount` (current charges, already correct)
- `paid_to_date_vnd` (prior balance) = `carryInDebt - carryInCredit` (keep as-is, this is just a sign flip for display)
- `balance_vnd` = `upstream.carry.carryOutDebt ?? -(upstream.carry.carryOutCredit ?? 0)` -- same formula as tuition page
- `recorded_payment_vnd` = `upstream.payments.monthPayments` (already correct)
- Compute `finalPayable` the same way: `totalAmount + carryInDebt - carryInCredit` (this already matches the tuition page)

The key fix is **one line**: change `balance_vnd` from `finalPayable - monthPayments` to use `carryOutDebt / carryOutCredit` directly from upstream, matching the tuition page exactly.

### File to modify
- `src/lib/invoice/adapter.ts` (1 line change)

