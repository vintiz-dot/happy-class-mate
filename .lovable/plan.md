

# Fix: Payment Not Reflecting Immediately

## Root Cause

The tuition list fetches data using a query with the key `["admin-tuition-live", month]` (in `useLiveTuitionData.ts`), but after saving a payment, both `RecordPaymentDialog` and `BatchPaymentDialog` invalidate a **different** key: `["admin-tuition-list", month]`. Since the wrong cache is being cleared, React Query never knows to re-fetch, and the UI stays stale until a manual page reload.

## Fix

Update the cache invalidation calls in both dialog components to use the correct query key `"admin-tuition-live"`.

### Files to Change

**1. `src/components/admin/RecordPaymentDialog.tsx`** (line 127)
- Change `"admin-tuition-list"` to `"admin-tuition-live"`

**2. `src/components/admin/BatchPaymentDialog.tsx`** (line 154)
- Change `"admin-tuition-list"` to `"admin-tuition-live"`

This is a two-line fix that will make payments reflect instantly in the UI.

