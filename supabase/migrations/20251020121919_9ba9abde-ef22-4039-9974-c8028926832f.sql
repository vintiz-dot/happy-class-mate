-- Drop the unique index on tx_id to allow double-entry bookkeeping
-- Each transaction needs two ledger entries (debit and credit) with the same tx_id
DROP INDEX IF EXISTS public.uniq_ledger_tx_id;