
# Fix: Payment Changes Not Reflecting in UI

## Root Cause

The `invalidateQueries` call correctly marks the cache as stale, but it doesn't guarantee the refetch completes before the dialog closes. Since `useLiveTuitionData` calls the edge function for every student in batches (a slow operation), the background refetch may not complete quickly enough -- or may silently fail. Additionally, the dialog's `handleClose` resets state immediately after invalidation fires, but before data arrives.

## Solution

Use `await queryClient.refetchQueries()` instead of `invalidateQueries` to **force a refetch and wait for it to complete** before closing the dialog. This guarantees the new data is loaded and rendered before the UI transitions.

### Files to Change

**1. `src/components/admin/RecordPaymentDialog.tsx`**
- Replace the fire-and-forget `invalidateQueries` with `await queryClient.refetchQueries({ queryKey: ["admin-tuition-live", month] })`
- Keep the `student-tuition` invalidation as-is (secondary)

**2. `src/components/admin/BatchPaymentDialog.tsx`**
- Same change: replace `invalidateQueries` with `await queryClient.refetchQueries`

This ensures the tuition list data is fully refreshed from the edge function before the dialog closes and the user sees the updated values.
