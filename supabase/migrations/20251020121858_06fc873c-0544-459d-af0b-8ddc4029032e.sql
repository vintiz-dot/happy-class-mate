-- Drop all constraints on tx_id in ledger_entries to allow double-entry bookkeeping
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.ledger_entries'::regclass 
        AND conname LIKE '%tx_id%'
    LOOP
        EXECUTE 'ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;