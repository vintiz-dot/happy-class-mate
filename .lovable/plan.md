

# Simplified Prior Balance Breakdown UI

## Problem Analysis

The current design is confusing because:
1. **Missing charges for some months** - payments show but no context of what they paid for
2. **Net balance per month** is shown but the running total isn't clear
3. **Too detailed** - individual sessions aren't intuitive for understanding debt/credit

## Proposed Solution: Simple Summary Table

Replace the complex breakdown with a clean, simple table showing just the essential information:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Prior Balance                                     +227,400 ₫    │
│ ✓ Credit (Family overpaid)                                      │
│                                                                 │
│ ▼ View History                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Month           Charged      Paid        Balance             │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ Oct 2025        967,200      967,200          0             │ │
│ │ Nov 2025        967,200    1,200,000    +232,800            │ │
│ │ Dec 2025        780,000      720,000      -5,400            │ │
│ │ Jan 2026        780,000      725,400          0             │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ Total         3,494,400    3,612,600    +227,400 Credit     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Table format** - Easy to scan across columns
2. **Three simple columns** - Charged, Paid, Running Balance
3. **Running balance** - Shows cumulative after each month
4. **Color coding** - Green for overpaid, Red for underpaid
5. **No individual session details** - Too granular, keep it high-level

## Implementation Changes

### File: `src/components/student/PriorBalanceBreakdown.tsx`

Replace the current complex nested layout with:

```tsx
<Collapsible>
  <CollapsibleTrigger>
    View History
  </CollapsibleTrigger>
  <CollapsibleContent>
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left py-1">Month</th>
          <th className="text-right py-1">Charged</th>
          <th className="text-right py-1">Paid</th>
          <th className="text-right py-1">Balance</th>
        </tr>
      </thead>
      <tbody>
        {months.map((m, idx) => {
          // Calculate running balance up to this point
          const runningBalance = months
            .slice(0, idx + 1)
            .reduce((sum, month) => sum + month.netBalance, 0);
          
          return (
            <tr key={m.month} className="border-b border-border/30">
              <td className="py-1.5">{formatShortMonth(m.month)}</td>
              <td className="text-right text-red-600">{formatVND(m.charges)}</td>
              <td className="text-right text-green-600">{formatVND(m.payments)}</td>
              <td className="text-right font-medium">
                {runningBalance > 0 ? '+' : ''}{formatVND(runningBalance)}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="font-semibold bg-muted/30">
          <td className="py-2">Total</td>
          <td className="text-right text-red-600">{formatVND(totalCharges)}</td>
          <td className="text-right text-green-600">{formatVND(totalPayments)}</td>
          <td className="text-right">{formatVND(netCarryIn)}</td>
        </tr>
      </tfoot>
    </table>
  </CollapsibleContent>
</Collapsible>
```

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Layout | Nested lists with icons | Clean table with columns |
| Columns | Variable per item | Fixed: Month, Charged, Paid, Balance |
| Balance shown | Per-month net | Running cumulative |
| Session details | Shown with class names | Hidden (not needed) |
| Icons | Multiple (up/down arrows) | None (color only) |

### Edge Function: No changes needed

The existing data structure already provides `charges` and `payments` per month - we just need to display it differently.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/student/PriorBalanceBreakdown.tsx` | Complete redesign to table format |

## Visual Comparison

**Before (confusing):**
```
October 2025                           0 đ
  ↑ Payment received              +967,200

November 2025                   +232,800 đ  
  ↑ Payment received            +1,200,000
```
*Problem: Where's the charge? Why is October "0"?*

**After (simple):**
```
Month      Charged      Paid      Balance
───────────────────────────────────────────
Oct 2025   967,200   967,200           0
Nov 2025   967,200 1,200,000    +232,800
```
*Clear: Charged vs Paid, running balance*

## Testing Checklist

- [ ] Verify table displays correctly with 1-4 months of history
- [ ] Check running balance calculation is correct
- [ ] Ensure colors are clear (red for charges, green for payments)
- [ ] Test on mobile viewport
- [ ] Verify empty state still works

