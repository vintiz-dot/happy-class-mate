// Pure mapping adapter - no computation, only picks/renames upstream fields

import type { InvoiceData } from './types';

const nv = <T>(v: T | null | undefined, d: T): T => (v ?? d);

/**
 * Maps upstream invoice projection to render format.
 * Pure mapping only - no math, no recomputation.
 */
export function mapUpstreamToInvoice(upstream: any): InvoiceData {
  return {
    invoice_number: nv(upstream.invoice_number ?? upstream.number, 'INV-DRAFT'),
    issue_date: nv(upstream.issue_date ?? upstream.created_at, new Date().toISOString()),
    billing_period: nv(upstream.month ?? upstream.billing_period, new Date().toISOString().slice(0, 7)),
    
    student: {
      id: nv(upstream.student_id, 'unknown'),
      full_name: nv(upstream.student_name ?? upstream.student?.full_name, 'Student'),
    },
    
    family: {
      name: upstream.family_name ?? upstream.family?.name,
    },
    
    bill_to_text: upstream.bill_to_text ?? 'Dear Parents,',
    
    classes: (upstream.class_breakdown ?? upstream.classes ?? []).map((c: any) => ({
      class_name: nv(c.class_name ?? c.name, 'Class'),
      sessions_count: nv(c.sessions_count ?? c.count ?? c.sessions, 0),
      amount_vnd: nv(c.amount_vnd ?? c.amount ?? c.total, 0),
    })),
    
    discounts: (upstream.discounts ?? []).map((d: any) => ({
      label: nv(d.label ?? d.name ?? d.type, 'Discount'),
      amount_vnd: nv(d.amount_vnd ?? d.amount, 0),
    })),
    
    subtotal_vnd: nv(upstream.subtotal_vnd ?? upstream.base_amount ?? upstream.subtotal, 0),
    total_due_vnd: nv(upstream.total_due_vnd ?? upstream.total_amount ?? upstream.total, 0),
    paid_to_date_vnd: nv(upstream.paid_to_date_vnd ?? upstream.paid_amount ?? upstream.paid, 0),
    balance_vnd: nv(upstream.balance_vnd ?? upstream.balance, 0),
    
    sessions: (upstream.sessions ?? upstream.session_details ?? []).map((s: any) => ({
      date: nv(s.date, ''),
      status: nv(s.status, 'Scheduled'),
      unit_price_vnd: nv(s.unit_price_vnd ?? s.rate ?? s.amount, 0),
      line_total_vnd: nv(s.line_total_vnd ?? s.total ?? s.amount, 0),
    })),
  };
}
