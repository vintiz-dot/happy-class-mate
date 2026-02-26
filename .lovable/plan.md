

# Fix Revenue Snapshot in Overview Stats

## Problem

The "Revenue This Month" card in `OverviewStats.tsx` reads raw `paid_amount` and `total_amount` directly from the `invoices` table. This produces wrong numbers because:

1. **`paid_amount`** on invoices is a stale/legacy field — the real payment tracking uses `recorded_payment` and the `calculate-tuition` edge function's carry logic
2. **`total_amount`** on invoices doesn't account for carry-in debt/credit, which changes the "final payable" amount
3. The result was a 700% collection rate because `paid_amount` totals exceeded `total_amount` totals

The Finance tab's `AdminTuitionListEnhanced` gets accurate data by calling `useLiveTuitionData`, which invokes the `calculate-tuition` edge function per student and uses `recorded_payment` (actual month payments) and `finalPayable` (tuition + carry-in adjustments).

## Solution

Replace the direct invoice query in `OverviewStats` with a reuse of the existing `finance-summary` react-query cache. The `FinanceSummary` component already queries `total_amount` from invoices for the current month. For collection data, we add a `recorded_payment` sum to the same `FinanceSummary` query, so both the Finance Summary card and the Overview snapshot share one source of truth.

### Changes

**File: `src/components/admin/FinanceSummary.tsx`**
- Add `recorded_payment` to the invoices select query (line 27)
- Calculate `totalCollected` from `recorded_payment` and `collectionRate` from `totalCollected / totalTuition`
- Return these two new fields in the summary object
- Display a new "Collection" line in the Total Tuition Billed card

**File: `src/components/admin/OverviewStats.tsx`**
- Remove the direct invoices query (lines 59-62)
- Instead, consume the `finance-summary` query for the current month via `useQuery` with the same query key `["finance-summary", currentMonth]`
- If the finance summary data is already cached (admin visited Finance tab), it reuses it instantly; if not, it fetches the same data
- Map `totalTuition` → revenue billed, `totalCollected` → revenue collected, `collectionRate` → percentage

### Technical Detail

```typescript
// FinanceSummary.tsx — add to invoice query
const { data: invoices } = await supabase
  .from("invoices")
  .select("base_amount, discount_amount, total_amount, recorded_payment")
  .eq("month", selectedMonth);

const totalCollected = (invoices || []).reduce(
  (sum, inv) => sum + (inv.recorded_payment || 0), 0
);
const collectionRate = totalTuition > 0
  ? Math.round((totalCollected / totalTuition) * 100) : 0;

// OverviewStats.tsx — reuse finance-summary query
const { data: financeSummary } = useQuery({
  queryKey: ["finance-summary", currentMonth],
  queryFn: async () => { /* same logic as FinanceSummary */ },
  staleTime: 60000,
});
```

To avoid duplicating the `FinanceSummary` query function, we will extract it into a shared hook `useFinanceSummary(month)` that both components import.

### New file: `src/hooks/useFinanceSummary.ts`
- Extracts the query logic from `FinanceSummary.tsx` into a reusable hook
- Returns `{ data, isLoading }` with all summary fields including the new `totalCollected` and `collectionRate`

### Updated: `src/components/admin/FinanceSummary.tsx`
- Imports and uses `useFinanceSummary(selectedMonth)` instead of inline query
- Adds collection rate display to the UI

### Updated: `src/components/admin/OverviewStats.tsx`
- Imports `useFinanceSummary` for the current month
- Replaces the direct invoices query with `financeSummary.totalTuition`, `financeSummary.totalCollected`, `financeSummary.collectionRate`
- Revenue card shows net tuition billed as the main number, collection rate as the trend badge

No database changes needed. This is purely a client-side refactor to share the same data source.

