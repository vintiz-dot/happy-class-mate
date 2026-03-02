

## Plan: Fix Sibling Discount Preview + Speed Up Tuition Page

### Problem 1: Sibling Discount Preview Shows Non-Qualifying Families
The `compute-sibling-discounts` edge function returns ALL families, including those with `status: 'none'` (< 2 students) and `status: 'pending'` (< 2 students with positive tuition). The preview dialog renders all of them.

**Fix (frontend only):**
- In `SiblingDiscountCompute.tsx`, filter `previewResults` to exclude families with `status: 'none'` before displaying and before fetching family overrides.
- Also skip fetching family override data for non-qualifying families (saves N sequential DB calls).

### Problem 2: Tuition Page Extremely Slow
`useLiveTuitionData` calls `calculate-tuition` edge function **individually for every student** (batches of 10). With 30+ students, that's 30+ sequential edge function invocations, each doing ~8 DB queries internally. This causes 60+ second load times.

**Fix: Create a bulk `calculate-tuition-bulk` edge function**

1. **New edge function `calculate-tuition-bulk/index.ts`** that accepts `{ studentIds: string[], month: string }` and performs all the same calculations but with bulk queries:
   - Fetch ALL enrollments, sessions, attendance, discounts, invoices in single queries using `.in()` filters
   - Process all students in-memory using the same logic as the single-student version
   - Return an array of tuition results
   - This reduces ~240 DB queries (30 students x 8 queries) down to ~8 bulk queries

2. **Update `useLiveTuitionData.ts`** to call the new bulk endpoint instead of looping per-student:
   - Single edge function call instead of 30+
   - Remove the batch loop logic
   - Map the bulk response to the same `LiveTuitionItem[]` shape

3. **Update `supabase/config.toml`** to register the new function with `verify_jwt = false`.

### Technical Details

**Bulk edge function query strategy:**
- Single query for all students + families
- Single query for all enrollments across all students
- Single query for all sessions in the month for enrolled classes
- Single query for all attendance records
- Single query for all discount assignments
- Single query for all invoices for the month
- Single query for all sibling discount states
- Process in-memory with Maps for O(1) lookups

**Expected performance improvement:** From ~30-60 seconds down to ~2-3 seconds.

### Files to Create/Modify
- **Create:** `supabase/functions/calculate-tuition-bulk/index.ts`
- **Modify:** `src/hooks/useLiveTuitionData.ts` - call bulk endpoint
- **Modify:** `src/components/admin/SiblingDiscountCompute.tsx` - filter non-qualifying families from preview

