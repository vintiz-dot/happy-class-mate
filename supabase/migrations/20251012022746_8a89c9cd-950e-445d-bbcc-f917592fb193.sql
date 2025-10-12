-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'partial', 'credit');

-- Create account code enum for double-entry bookkeeping
CREATE TYPE public.account_code AS ENUM ('AR', 'REVENUE', 'DISCOUNT', 'CASH', 'BANK', 'CREDIT');

-- Create ledger_accounts table
CREATE TABLE public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  code public.account_code NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, code)
);

-- Create ledger_entries table for double-entry bookkeeping
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo TEXT,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  number TEXT,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  base_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  pdf_storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(student_id, month)
);

-- Create payments table for tracking payment transactions
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  memo TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create bank_info table (singleton)
CREATE TABLE public.bank_info (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name TEXT NOT NULL DEFAULT 'Sacombank',
  account_name TEXT NOT NULL DEFAULT 'Nguyễn Thị Thu Hường',
  account_number TEXT NOT NULL DEFAULT '020975679889',
  vietqr_storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default bank info
INSERT INTO public.bank_info (id) VALUES (1);

-- Create indexes
CREATE INDEX idx_ledger_entries_account ON public.ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_tx ON public.ledger_entries(tx_id);
CREATE INDEX idx_ledger_entries_month ON public.ledger_entries(month);
CREATE INDEX idx_invoices_student ON public.invoices(student_id);
CREATE INDEX idx_invoices_month ON public.invoices(month);
CREATE INDEX idx_payments_student ON public.payments(student_id);

-- Create updated_at triggers
CREATE TRIGGER update_ledger_accounts_updated_at
  BEFORE UPDATE ON public.ledger_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ledger_entries_updated_at
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_info_updated_at
  BEFORE UPDATE ON public.bank_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_info ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ledger_accounts
CREATE POLICY "Admins can manage ledger accounts"
  ON public.ledger_accounts
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their ledger accounts"
  ON public.ledger_accounts
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family ledger accounts"
  ON public.ledger_accounts
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for ledger_entries
CREATE POLICY "Admins can manage ledger entries"
  ON public.ledger_entries
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their ledger entries"
  ON public.ledger_entries
  FOR SELECT
  USING (
    account_id IN (
      SELECT la.id FROM public.ledger_accounts la
      JOIN public.students s ON la.student_id = s.id
      WHERE s.linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family ledger entries"
  ON public.ledger_entries
  FOR SELECT
  USING (
    account_id IN (
      SELECT la.id FROM public.ledger_accounts la
      JOIN public.students s ON la.student_id = s.id
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Admins can manage invoices"
  ON public.invoices
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their invoices"
  ON public.invoices
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family invoices"
  ON public.invoices
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for payments
CREATE POLICY "Admins can manage payments"
  ON public.payments
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their payments"
  ON public.payments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family payments"
  ON public.payments
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for bank_info
CREATE POLICY "Everyone can view bank info"
  ON public.bank_info
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bank info"
  ON public.bank_info
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');