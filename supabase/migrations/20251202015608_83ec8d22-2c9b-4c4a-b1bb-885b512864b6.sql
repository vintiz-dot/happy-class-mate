-- Add carry balance columns to invoices table for proper credit/debit tracking
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS carry_in_credit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS carry_in_debt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS carry_out_credit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS carry_out_debt integer DEFAULT 0;

COMMENT ON COLUMN invoices.carry_in_credit IS 'Prior month credit balance (family overpaid)';
COMMENT ON COLUMN invoices.carry_in_debt IS 'Prior month debt balance (family owes)';
COMMENT ON COLUMN invoices.carry_out_credit IS 'Current month closing credit balance';
COMMENT ON COLUMN invoices.carry_out_debt IS 'Current month closing debt balance';