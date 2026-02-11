

# Intuitive Payment Recording on Admin Tuition Page

## Problem

The current "Record Payment" flow on the Tuition page has several UX and functional issues:

1. **Tiny gear icon** -- easy to miss; the "Record Pay" button only shows on desktop in the Enhanced view but the Tuition page uses the basic `AdminTuitionList`
2. **Cramped inline form** -- amount, date, and method fields are squeezed into a single row inside the card, making it hard to use especially on mobile
3. **Replaces instead of adds** -- clicking "Record Pay" sets `recorded_payment` to the entered value, overwriting any previous payment. If a student paid 500K last week and 300K today, the admin has to manually add them up
4. **Fails for new students** -- students without an existing invoice get a `placeholder-xxx` ID, so the update query silently fails

## Solution

Create a dedicated **Record Payment Dialog** that opens when the admin clicks "Record Pay" on any student card. This dialog will:

- Show the student's financial summary (payable, already paid, outstanding) at the top for context
- Have a clear amount input with a "Pay Full" quick-fill button
- Include date, method, and optional memo fields
- **Add** the payment to the existing `recorded_payment` (not replace)
- **Create the invoice** if one doesn't exist yet (using calculated tuition data)
- Show a live preview of the resulting balance before saving
- Reflect immediately after save via query invalidation

## Technical Details

### New File: `src/components/admin/RecordPaymentDialog.tsx`

A focused dialog component with these props:
- `open`, `onClose` -- dialog state
- `item` -- the tuition data item (student info, financial data, invoice id)
- `month` -- current month string
- `onSuccess` -- callback after successful save

The dialog UI:
- Header: student name + current status badge
- Summary bar: Payable | Already Paid | Outstanding
- Amount input with "Pay Full" button that auto-fills the outstanding amount
- Date picker (defaults to today)
- Payment method select (Cash, Bank Transfer, Card, Other)
- Optional memo/note field
- Live preview: "After this payment: Balance will be X" with color coding
- Save button with loading state

Save logic:
1. Check if invoice exists (real UUID vs `placeholder-xxx`)
2. If no invoice exists, create one using the item's calculated values (`base_amount`, `discount_amount`, `total_amount`) and set `recorded_payment` to the entered amount
3. If invoice exists, **add** the entered amount to the existing `recorded_payment`
4. Update invoice status accordingly (open/partial/paid)
5. Write an audit log entry with old/new values, date, method, and memo
6. Invalidate relevant React Query caches
7. Show success toast and close

### Modified File: `src/components/admin/AdminTuitionList.tsx`

- Import and render the new `RecordPaymentDialog`
- Replace the inline edit form with opening the dialog
- Remove the inline editing state (`editingInvoiceId`, `editValue`, `editDate`, `editMethod`) and the `handleSaveEdit` function -- all of this moves into the dialog
- Add a visible "Record Pay" button with a CreditCard icon on each student row (not just a tiny gear icon)

### Files Changed

| File | Change |
|------|--------|
| `src/components/admin/RecordPaymentDialog.tsx` | New component -- payment recording dialog with financial summary, additive logic, and invoice creation |
| `src/components/admin/AdminTuitionList.tsx` | Replace inline edit form with dialog trigger; add visible "Record Pay" button per student |

