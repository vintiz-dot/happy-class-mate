
# Enhanced Prior Balance Details for Admin Student Card

## Overview

This plan enhances the "Prior Balance" card in the Admin student tuition view to show a detailed breakdown of what contributes to the balance/credit, including:
- Month-by-month breakdown of unpaid charges
- Canceled sessions that created credits (with class name and date)
- Payment history showing amounts applied
- Clear explanations for each line item

## Current State

The `StudentTuitionTab.tsx` currently shows:
- A simple card with carry-in debt or credit amount
- Generic label like "Credit (Family overpaid)" or "Debt (Family owes)"

## Proposed Enhancement

Transform the Prior Balance card into an expandable detailed breakdown showing:

```text
┌─────────────────────────────────────────────────────────────┐
│ Prior Balance                             -600,000 ₫ (Debt) │
├─────────────────────────────────────────────────────────────┤
│ ▼ View Details                                              │
│                                                             │
│ November 2025                                               │
│   └─ SKY 1: Unpaid balance              -600,000 ₫         │
│                                                             │
│ December 2025                                               │
│   ├─ SKY 1 (Jan 3): Canceled            +210,000 ₫         │
│   └─ Payment received                   +1,795,500 ₫        │
│   └─ Charges                            -1,890,000 ₫        │
│   Net: -94,500 ₫                                            │
│                                                             │
│ Cumulative Balance: -600,000 ₫                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Enhance Edge Function: `calculate-tuition`

**File:** `supabase/functions/calculate-tuition/index.ts`

Add a new `priorBalanceBreakdown` object to the response containing:

```typescript
priorBalanceBreakdown: {
  months: [
    {
      month: "2025-11",
      label: "November 2025",
      charges: 2490000,
      payments: 1890000,
      canceledSessions: [],
      netBalance: -600000,
      items: [
        { type: "charge", class: "SKY 1", amount: 2490000, description: "9 sessions" },
        { type: "payment", amount: 1890000, date: "2025-11-15", method: "Bank Transfer" },
      ]
    },
    {
      month: "2025-12",
      label: "December 2025",
      charges: 1795500,
      payments: 1795500,
      canceledSessions: [
        { date: "2026-01-03", class: "SKY 1", amount: 210000, reason: "Bulk cancellation" }
      ],
      netBalance: 0,
      items: [...]
    }
  ],
  summary: {
    totalPriorCharges: 4285500,
    totalPriorPayments: 3685500,
    totalCanceledCredits: 0,
    netCarryIn: -600000
  }
}
```

**Key additions:**
- Query all prior invoices with their `class_breakdown` jsonb field
- Query canceled sessions for this student in prior months
- Query payments grouped by the invoice month they were attributed to
- Build a chronological breakdown

### 2. Update Hook: `useStudentMonthFinance`

**File:** `src/hooks/useStudentMonthFinance.ts`

Add new interface fields:

```typescript
interface PriorBalanceItem {
  type: 'charge' | 'payment' | 'canceled' | 'adjustment';
  month: string;
  className?: string;
  classId?: string;
  amount: number;
  date?: string;
  reason?: string;
  description?: string;
}

interface PriorBalanceMonth {
  month: string;
  label: string;
  charges: number;
  payments: number;
  canceledSessions: Array<{
    date: string;
    className: string;
    amount: number;
    reason?: string;
  }>;
  netBalance: number;
  items: PriorBalanceItem[];
}

// Add to StudentMonthFinanceData:
priorBalanceBreakdown?: {
  months: PriorBalanceMonth[];
  summary: {
    totalPriorCharges: number;
    totalPriorPayments: number;
    totalCanceledCredits: number;
    netCarryIn: number;
  };
};
```

### 3. Create Component: `PriorBalanceBreakdown`

**File:** `src/components/student/PriorBalanceBreakdown.tsx`

A collapsible component showing:
- Expandable monthly sections
- Color-coded items (red for charges, green for payments/credits)
- Icons for different transaction types
- Clear labels with class names and dates

**UI Components used:**
- `Collapsible` from Radix UI
- `Badge` for status indicators
- Icons: `ArrowDown`, `ArrowUp`, `Calendar`, `X` (canceled)

### 4. Update: `StudentTuitionTab.tsx`

**File:** `src/components/student/StudentTuitionTab.tsx`

Replace the simple Prior Balance card with the new `PriorBalanceBreakdown` component:

```tsx
<Card className={...}>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Prior Balance
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold ...">
      {formatted balance}
    </p>
    
    {/* NEW: Expandable breakdown */}
    {tuitionData.priorBalanceBreakdown && (
      <PriorBalanceBreakdown 
        breakdown={tuitionData.priorBalanceBreakdown} 
      />
    )}
  </CardContent>
</Card>
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/student/PriorBalanceBreakdown.tsx` | Expandable breakdown UI component |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/calculate-tuition/index.ts` | Add prior balance breakdown data to response |
| `src/hooks/useStudentMonthFinance.ts` | Add new TypeScript interfaces and normalize new fields |
| `src/components/student/StudentTuitionTab.tsx` | Integrate the new breakdown component |

## Technical Details

### Edge Function Changes

Add to `calculate-tuition/index.ts` after the existing prior charges calculation:

```typescript
// Build prior balance breakdown
const priorBalanceBreakdown = {
  months: [] as any[],
  summary: {
    totalPriorCharges: priorCharges,
    totalPriorPayments: priorPayments,
    totalCanceledCredits: 0,
    netCarryIn: carryInBalance
  }
};

// Fetch prior invoices with class breakdown
const { data: priorInvoicesDetailed } = await supabase
  .from("invoices")
  .select("month, total_amount, recorded_payment, class_breakdown")
  .lt("month", month)
  .eq("student_id", studentId)
  .order("month", { ascending: true });

// Fetch canceled sessions in prior months that created credits
const { data: canceledSessions } = await supabase
  .from("sessions")
  .select("id, date, class_id, status, canceled_reason, classes(name, session_rate_vnd)")
  .eq("status", "Canceled")
  .lt("date", startDate)
  .in("class_id", activeClassIds);

// Build month-by-month breakdown
for (const invoice of priorInvoicesDetailed || []) {
  const monthLabel = new Date(`${invoice.month}-01`).toLocaleDateString('en-US', { 
    month: 'long', year: 'numeric' 
  });
  
  const items = [];
  
  // Add class charges from breakdown
  for (const classItem of invoice.class_breakdown || []) {
    items.push({
      type: 'charge',
      className: classItem.class_name,
      amount: -classItem.amount_vnd,
      description: `${classItem.sessions_count} sessions`
    });
  }
  
  // Add payment if any
  if (invoice.recorded_payment > 0) {
    items.push({
      type: 'payment',
      amount: invoice.recorded_payment,
      description: 'Payment received'
    });
  }
  
  priorBalanceBreakdown.months.push({
    month: invoice.month,
    label: monthLabel,
    charges: invoice.total_amount,
    payments: invoice.recorded_payment,
    canceledSessions: [],
    netBalance: invoice.recorded_payment - invoice.total_amount,
    items
  });
}
```

### UI Component Design

The `PriorBalanceBreakdown` component will use:

```tsx
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
    <ChevronRight className="h-4 w-4 transition-transform" />
    View Details
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="mt-3 space-y-4 border-t pt-3">
      {breakdown.months.map((month) => (
        <div key={month.month} className="space-y-2">
          <p className="text-sm font-medium">{month.label}</p>
          <div className="ml-4 space-y-1">
            {month.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  {item.type === 'charge' && <ArrowDown className="h-3 w-3 text-red-500" />}
                  {item.type === 'payment' && <ArrowUp className="h-3 w-3 text-green-500" />}
                  {item.type === 'canceled' && <X className="h-3 w-3 text-blue-500" />}
                  {item.className && `${item.className}: `}
                  {item.description}
                </span>
                <span className={item.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                  {item.amount > 0 ? '+' : ''}{formatVND(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </CollapsibleContent>
</Collapsible>
```

## Sample Output

For a student with 600,000 VND prior debt:

```text
Prior Balance: -600,000 ₫

▼ View Details

November 2025
  ├─ SKY 1: 12 sessions         -2,520,000 ₫
  └─ Payment received           +1,890,000 ₫
  Net: -630,000 ₫

December 2025  
  ├─ SKY 1: 9 sessions          -1,890,000 ₫
  ├─ SKY 1 (Jan 3): Canceled    +210,000 ₫
  └─ Payment received           +1,795,500 ₫
  Net: +115,500 ₫

January 2026
  ├─ SKY 1: 8 sessions          -1,680,000 ₫
  └─ Payment received           +1,680,000 ₫
  Net: 0 ₫

────────────────────────────────
Cumulative: -600,000 ₫ (Debt)
```

## Testing Checklist

- [ ] Open student detail page for a student with prior balance
- [ ] Verify balance amount matches between simple view and detailed breakdown
- [ ] Expand breakdown and verify month labels are correct
- [ ] Check that canceled sessions show class name and date
- [ ] Verify payments show correctly with positive amounts (green)
- [ ] Test with student having credit balance (overpaid)
- [ ] Test with student having zero prior balance (should hide or show "No prior balance")
- [ ] Test mobile responsiveness of the expanded view
