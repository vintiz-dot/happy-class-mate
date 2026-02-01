

# Optimize Sibling Balance Loading in Smart Family Payment

## Problem

The Smart Family Payment modal experiences slow loading times when fetching sibling balances because it makes sequential API calls to `calculate-tuition` for each sibling. For a family with 3 children, this means waiting for 3 network round-trips in series, causing delays of 6-10+ seconds.

## Solution

Parallelize the balance fetching calls using `Promise.all()` to execute all sibling balance requests concurrently, reducing loading time from sequential (N × latency) to parallel (1 × latency).

## Changes

### 1. Modify `SmartFamilyPaymentModal.tsx`

**Current sequential code (slow):**
```typescript
for (const student of studentsData) {
  const { data } = await supabase.functions.invoke("calculate-tuition", {...});
  balances.push({...});
}
```

**New parallel code (fast):**
```typescript
const balanceResults = await Promise.all(
  studentsData.map(async (student) => {
    const { data } = await supabase.functions.invoke("calculate-tuition", {...});
    return { id: student.id, name: student.full_name, debt: ..., credit: ... };
  })
);
```

### 2. Add Loading Skeleton UI

While balances load (even in parallel, it takes 1-2 seconds), show a polished loading skeleton instead of just a spinner to improve perceived performance:
- Show placeholder cards for each sibling position
- Animate with subtle pulse effect
- Display family name immediately (from local data)

### 3. Implementation Details

**File: `src/components/admin/SmartFamilyPaymentModal.tsx`**

Changes to `loadSiblingBalances` function:

```typescript
const loadSiblingBalances = async () => {
  setLoadingBalances(true);
  try {
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("family_id", selectedFamilyId)
      .eq("is_active", true)
      .order("full_name");

    if (!studentsData || studentsData.length === 0) {
      setSiblings([]);
      return;
    }

    // Parallel fetch - all siblings at once
    const balancePromises = studentsData.map(async (student) => {
      try {
        const { data } = await supabase.functions.invoke("calculate-tuition", {
          body: { studentId: student.id, month: formData.month }
        });
        return {
          id: student.id,
          name: student.full_name,
          debt: data?.carry?.carryOutDebt ?? 0,
          credit: data?.carry?.carryOutCredit ?? 0,
        };
      } catch (e) {
        console.error(`Failed to fetch balance for ${student.id}:`, e);
        return {
          id: student.id,
          name: student.full_name,
          debt: 0,
          credit: 0,
        };
      }
    });

    const balances = await Promise.all(balancePromises);
    
    // Sort by debt descending
    balances.sort((a, b) => b.debt - a.debt);
    setSiblings(balances);
  } finally {
    setLoadingBalances(false);
  }
};
```

### 4. Add Skeleton Loading State

Add a loading skeleton to show placeholder content while fetching:

```typescript
{loadingBalances ? (
  <div className="border rounded-lg divide-y">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>
    ))}
  </div>
) : (
  // Existing sibling list UI
)}
```

## Performance Improvement

| Scenario | Before (Sequential) | After (Parallel) |
|----------|---------------------|------------------|
| 2 siblings | ~4 seconds | ~2 seconds |
| 3 siblings | ~6 seconds | ~2 seconds |
| 4 siblings | ~8 seconds | ~2 seconds |
| 5 siblings | ~10 seconds | ~2 seconds |

The parallel approach reduces loading time to approximately the time of a single API call, regardless of sibling count.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/SmartFamilyPaymentModal.tsx` | Replace sequential loop with `Promise.all()`, add Skeleton import and loading UI |

## Testing Checklist

- [ ] Select a family with 2+ siblings
- [ ] Verify balances load in ~2 seconds instead of N×2 seconds
- [ ] Confirm skeleton UI appears during loading
- [ ] Verify correct debt sorting after load
- [ ] Test with different month selections

