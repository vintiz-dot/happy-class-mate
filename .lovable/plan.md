

# Fix: Family-Level Balance Netting for Overdue Alerts

## Problem
Currently, overdue alerts are computed per-student. If a family has two siblings where one owes 20,000₫ and the other overpaid by 20,000₫, both get flagged individually — but the family's net balance is actually zero.

## Solution
In `AdminAlerts.tsx`, after computing per-student net balances, group students by `family_id`. Sum balances within each family. Only generate alerts when the **family-level** net balance is positive (i.e., the family actually owes money).

### Changes to `src/components/admin/AdminAlerts.tsx`

1. **Update the invoices query** to also fetch `students:student_id(full_name, family_id)` — adding `family_id` to the join
2. **After computing per-student balances**, group students by `family_id`:
   - Students without a family are treated individually (no netting)
   - Students with a family: sum all sibling balances. If family net ≤ 0, skip all siblings. If family net > 0, create one alert per family (linking to `/families/:familyId`) showing the family name and net amount
3. **Fetch family names** — add a parallel query for `families(id, name)` to display "Smith Family — overdue" instead of individual student names
4. **Alert detail** shows which siblings contribute to the debt and the net family amount

### Logic pseudocode
```text
studentBalances = Map<studentId, { name, familyId, netDebt }>
familyGroups = Map<familyId, { students[], netBalance }>

for each student with familyId:
  add to familyGroups[familyId]
  familyGroups[familyId].netBalance += student.netDebt  // negative if overpaid

for each family:
  if netBalance > 0 → create alert linking to /families/:id
  if netBalance <= 0 → no alert (balanced or overpaid)

for students without family:
  if netDebt > 0 → create individual alert (existing behavior)
```

### Files Changed

| Action | File |
|--------|------|
| Modified | `src/components/admin/AdminAlerts.tsx` |

Single file, ~30 lines changed in the overdue calculation section (lines 29-71).

