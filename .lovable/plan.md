

# Speed Up Finance Page Payment Recording

## Problem

After recording a payment, the system calls `await queryClient.refetchQueries(["admin-tuition-live", month])` which re-invokes the `calculate-tuition` edge function for **every single student** (in batches of 10). For a class with 30 students, that's 30 sequential edge function calls just to update one student's payment. This makes the save button feel frozen for 10-30+ seconds.

## Solution: Optimistic Cache Updates

Instead of refetching all students from the edge function after a payment, **directly update the cached data** for only the affected student(s). The payment amount and resulting balance can be computed client-side since we already have all the numbers.

### Changes

**1. `src/components/admin/RecordPaymentDialog.tsx`**
- Replace `await queryClient.refetchQueries(...)` with `queryClient.setQueryData(...)` to optimistically patch just the one student's `recorded_payment`, `balance`, `carry_out_debt`, `carry_out_credit`, and `status` in the cached array.
- This makes the save feel instant.

**2. `src/components/admin/BatchPaymentDialog.tsx`**
- Same approach: after all payments succeed, use `queryClient.setQueryData(...)` to patch all affected students in one pass through the cached array.
- Remove the blocking `await refetchQueries`.

**3. Both dialogs** will also fire a background `queryClient.invalidateQueries(...)` (non-blocking) so the next time the user navigates away and back, they get a full server-verified refresh. This gives us instant UI feedback now and eventual consistency.

### How the optimistic update works

```text
Before save:
  cached item: { recorded_payment: 100000, finalPayable: 500000, balance: ... }

User enters: 200000

After save (optimistic patch):
  cached item: { recorded_payment: 300000, status: "partial", 
                  carry_out_debt: max(0, 500000 - 300000),
                  carry_out_credit: max(0, 300000 - 500000),
                  balance: 500000 - 300000 }
```

### Technical Detail

The `queryClient.setQueryData` call will:
1. Get the current `["admin-tuition-live", month]` cache (array of students)
2. Map through it, finding the matching `student_id`
3. Return a new array with updated financial fields for that student
4. React Query updates the UI immediately with zero network calls

### Files to modify
- `src/components/admin/RecordPaymentDialog.tsx`
- `src/components/admin/BatchPaymentDialog.tsx`
