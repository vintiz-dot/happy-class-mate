-- Remove the unique constraint that prevents double-entry bookkeeping
-- Each transaction needs two entries (debit and credit) with the same tx_id
ALTER TABLE public.ledger_entries 
DROP CONSTRAINT IF EXISTS uniq_ledger_tx_id;