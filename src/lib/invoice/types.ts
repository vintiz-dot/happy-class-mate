// Mirror-only types - no computation, just data shapes

export interface InvoiceClassBreakdown {
  class_name: string;
  sessions_count: number;
  amount_vnd: number;
  net_amount_vnd?: number; // After class-specific discounts
}

export interface InvoiceDiscount {
  label: string;
  amount_vnd: number;
}

export interface InvoiceSession {
  date: string;
  status: string;
  unit_price_vnd: number;
  line_total_vnd: number;
  class_name: string;
}

export interface InvoiceData {
  invoice_number: string;
  issue_date: string;
  billing_period: string;
  student: {
    id: string;
    full_name: string;
  };
  family?: {
    name?: string;
  };
  bill_to_text?: string;
  
  classes: InvoiceClassBreakdown[];
  discounts: InvoiceDiscount[];
  
  subtotal_vnd: number;
  total_due_vnd: number; // Current month charges only
  paid_to_date_vnd: number; // Prior balance (prior payments - prior charges)
  balance_vnd: number; // Final payable after current payments
  recorded_payment_vnd?: number; // Current month recorded payment
  
  sessions: InvoiceSession[];
}

export interface BankInfo {
  org_name?: string;
  org_address?: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  vietqr_storage_key?: string;
}
