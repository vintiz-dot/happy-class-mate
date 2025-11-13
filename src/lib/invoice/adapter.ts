// Pure mapping adapter - no computation, only picks/renames upstream fields

import type { InvoiceData } from './types';

const nv = <T>(v: T | null | undefined, d: T): T => (v ?? d);

/**
 * Maps upstream invoice projection to render format.
 * Pure mapping only - no math, no recomputation.
 */
export function mapUpstreamToInvoice(upstream: any): InvoiceData {
  // Generate invoice number from student ID and month
  const invoiceNumber = `INV-${upstream.month ?? new Date().toISOString().slice(0, 7)}-${(upstream.student_id ?? '').slice(0, 8)}`;
  
  // Calculate carry-in balance (prior payments - prior charges)
  const carryInCredit = nv(upstream.carry?.carryInCredit, 0);
  const carryInDebt = nv(upstream.carry?.carryInDebt, 0);
  const carryInBalance = carryInCredit - carryInDebt;
  
  // Final payable = current charges + carry-in balance (debt positive, credit negative)
  const currentCharges = nv(upstream.totalAmount, 0);
  const finalPayable = currentCharges + carryInBalance;
  
  return {
    invoice_number: nv(upstream.invoice_number, invoiceNumber),
    issue_date: nv(upstream.issue_date, new Date().toISOString()),
    billing_period: nv(upstream.month, new Date().toISOString().slice(0, 7)),
    
    student: {
      id: nv(upstream.student_id, 'unknown'),
      full_name: nv(upstream.student_name, 'Student'),
    },
    
    family: {
      name: upstream.family_name,
    },
    
    bill_to_text: upstream.bill_to_text ?? 'Dear Parents,',
    
    classes: (upstream.class_breakdown ?? []).map((c: any) => ({
      class_name: nv(c.class_name, 'Class'),
      sessions_count: nv(c.sessions_count, 0),
      amount_vnd: nv(c.amount_vnd, 0),
    })),
    
    discounts: (upstream.discounts ?? []).map((d: any) => ({
      label: nv(d.name, 'Discount'),
      amount_vnd: -Math.abs(nv(d.amount, 0)), // Ensure negative
    })),
    
    subtotal_vnd: nv(upstream.baseAmount, 0),
    total_due_vnd: currentCharges,
    paid_to_date_vnd: carryInBalance, // Now shows carry-in balance (prior payments - prior charges)
    balance_vnd: finalPayable - nv(upstream.payments?.monthPayments, 0), // Final balance after current month payment
    recorded_payment_vnd: nv(upstream.payments?.monthPayments, 0), // Current month recorded payment
    
    sessions: (upstream.sessionDetails ?? []).map((s: any) => ({
      date: nv(s.date, ''),
      status: nv(s.status, 'Scheduled'),
      unit_price_vnd: nv(s.rate, 0),
      line_total_vnd: nv(s.rate, 0),
      class_name: nv(s.class_name, 'Unknown'),
    })),
  };
}
