-- Add family payment tracking and idempotency
ALTER TABLE payments ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES payments(id);

-- Add unique tx_key for idempotency
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS tx_key TEXT UNIQUE;

-- Create payment_allocations table for family payment tracking
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  allocated_amount INTEGER NOT NULL,
  allocation_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_parent ON payment_allocations(parent_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_student ON payment_allocations(student_id);

-- Create settlements table for tracking bill settlements
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  month TEXT NOT NULL,
  settlement_type TEXT NOT NULL CHECK (settlement_type IN ('discount', 'voluntary_contribution', 'unapplied_cash')),
  amount INTEGER NOT NULL,
  reason TEXT,
  consent_given BOOLEAN DEFAULT FALSE,
  approver_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  tx_id UUID NOT NULL,
  before_balance INTEGER NOT NULL,
  after_balance INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settlements_student ON settlements(student_id);
CREATE INDEX IF NOT EXISTS idx_settlements_month ON settlements(month);

-- Create payment_modifications table for audit trail
CREATE TABLE IF NOT EXISTS payment_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id UUID NOT NULL REFERENCES payments(id),
  reversal_payment_id UUID REFERENCES payments(id),
  new_payment_id UUID REFERENCES payments(id),
  modification_reason TEXT,
  before_data JSONB NOT NULL,
  after_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_modifications_original ON payment_modifications(original_payment_id);

-- RLS Policies for new tables
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modifications ENABLE ROW LEVEL SECURITY;

-- Admins can manage all records
CREATE POLICY "Admins can manage payment_allocations" ON payment_allocations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage settlements" ON settlements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view payment_modifications" ON payment_modifications
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own allocations and settlements
CREATE POLICY "Students can view own allocations" ON payment_allocations
  FOR SELECT USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Students can view own settlements" ON settlements
  FOR SELECT USING (can_view_student(student_id, auth.uid()));