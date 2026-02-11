

# Fix Smart Family Payment Discounts + Add Quick Payment to Admin Tuition Page

## Issue 1: Smart Family Payment Not Showing Discounts

### Root Cause
The Smart Family Payment modal fetches each sibling's `carryOutDebt` from `calculate-tuition`, which IS post-discount. However, the modal only displays "Owes X" without showing:
- The base (pre-discount) amount
- Applied discounts and their values
- The net (post-discount) tuition for the current month

This makes it impossible for the admin to verify whether discounts were applied before submitting the payment. Additionally, the edge function should be enhanced to show discount transparency.

### Changes

**File: `src/components/admin/SmartFamilyPaymentModal.tsx`**
- Expand the `SiblingBalance` interface to include `baseAmount`, `totalDiscount`, `totalAmount` (post-discount current charges), and `discounts` array from `calculate-tuition`
- Update `loadSiblingBalances` to capture these additional fields from the edge function response
- Update the sibling balance list UI to show:
  - Base amount, discount amount, net charges (post-discount)
  - Individual discount names/amounts in a collapsible section
  - Debt (which includes carry-in from prior months)
- Update `totalFamilyDebt` to clearly label it as post-discount
- The allocation preview already uses `carryOutDebt` (post-discount), so the waterfall logic itself is correct

**File: `supabase/functions/smart-family-payment/index.ts`**
- When fetching sibling balances, also capture `totalAmount`, `baseAmount`, `totalDiscount`, and `discounts` from calculate-tuition response
- Include discount details in the audit log entries for transparency
- If no invoice exists for a sibling in the current month, create one so the payment is properly tracked (currently payments are lost if no invoice exists)

## Issue 2: Admin Tuition Page Missing Quick Payment Button

### Root Cause
The `/tuition` page for admin uses `AdminTuitionList` component, which has a basic inline payment editor (small gear icon) but no prominent "Smart Family Payment" button. Meanwhile, the Finance > Tuition tab (`AdminTuitionListEnhanced`) has a visible "Record Pay" button on each card and a global "Smart Family Payment" button.

### Changes

**File: `src/pages/Tuition.tsx`**
- Add the `SmartFamilyPaymentModal` component to the admin tuition view
- Add a "Smart Family Payment" button (with Wallet icon) next to the MonthPicker in the header area
- This matches the Finance tab's layout and gives admins quick access from the Tuition page

## Technical Details

### SmartFamilyPaymentModal - Enhanced Sibling Display

The sibling balance section will change from:

```
[1] Student Name          Owes 2,000,000 VND
```

To:

```
[1] Student Name
    Base: 2,500,000 | Discount: -500,000 | Net: 2,000,000
    Discounts: Sibling (10%), Enrollment (200K)
    Carry-in debt: 300,000
    Total owes: 2,300,000 VND
```

### Smart Family Payment Edge Function - Invoice Safety

When recording a payment allocation for a sibling, if no invoice exists for the current month:
- Create a new invoice record with the calculated amounts from `calculate-tuition`
- Set `recorded_payment` to the allocated amount
- This prevents the "payment goes invisible" bug where `calculate-tuition` reads `monthPayments` from `invoices.recorded_payment`

### Files Changed

| File | Change |
|------|--------|
| `src/components/admin/SmartFamilyPaymentModal.tsx` | Show discount breakdown per sibling, enhanced balance display |
| `supabase/functions/smart-family-payment/index.ts` | Capture discount data, create invoice if missing, audit log discounts |
| `src/pages/Tuition.tsx` | Add Smart Family Payment button and modal to admin view |

