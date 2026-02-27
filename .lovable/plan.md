

# Fix: Student List Enrollment Display

## Problem
The `StudentsList` query fetches all enrollments regardless of `end_date`, so:
- Students show classes they've left (ended enrollments still display)
- Duplicate class names appear (e.g., "Venus, Venus, Jupiter" for Capybara — likely re-enrolled)

## Solution
In `src/components/admin/StudentsList.tsx`:

1. **Filter out ended enrollments** — add `.is("enrollments.end_date", null)` to the query so only active enrollments are fetched
2. **Deduplicate class names** — use a `Set` or `filter` on the display line to prevent duplicate class names from showing

### Changes

**File: `src/components/admin/StudentsList.tsx`**

- Line 44: Add `.is("enrollments.end_date", null)` after the `is_active` filter to exclude ended enrollments
- Line 149: Deduplicate class names using `[...new Set(...)]` before joining

