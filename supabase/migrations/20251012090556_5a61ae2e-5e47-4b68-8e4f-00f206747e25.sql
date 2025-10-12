-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Job lock to avoid double-runs
CREATE TABLE IF NOT EXISTS public.job_lock (
  job text NOT NULL,
  month text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (job, month)
);

ALTER TABLE public.job_lock ENABLE ROW LEVEL SECURITY;

-- RLS: admin read, service role full
CREATE POLICY job_lock_admin_select ON public.job_lock
  FOR SELECT USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY job_lock_service_all ON public.job_lock
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Add projected_base_snapshot to sibling_discount_state if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sibling_discount_state' 
    AND column_name = 'projected_base_snapshot'
  ) THEN
    ALTER TABLE public.sibling_discount_state ADD COLUMN projected_base_snapshot int NULL;
  END IF;
END$$;

-- Update RLS on sibling_discount_state for service role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sibling_discount_state' AND policyname='sds_service_all') THEN
    CREATE POLICY sds_service_all ON public.sibling_discount_state
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Guard ledger tx duplication
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_tx_id ON public.ledger_entries(tx_id);

-- Helper: retroactive sibling credit (double-entry)
CREATE OR REPLACE FUNCTION public.post_sibling_retro_credit(
  p_student_id uuid,
  p_month text,
  p_amount int,
  p_memo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_ar_id uuid;
  v_disc_id uuid;
  v_tx uuid := gen_random_uuid();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0';
  END IF;

  SELECT id INTO v_ar_id FROM public.ledger_accounts WHERE student_id = p_student_id AND code = 'AR' LIMIT 1;
  SELECT id INTO v_disc_id FROM public.ledger_accounts WHERE student_id = p_student_id AND code = 'DISCOUNT' LIMIT 1;
  IF v_ar_id IS NULL OR v_disc_id IS NULL THEN
    RAISE EXCEPTION 'Missing AR or DISCOUNT account for student %', p_student_id;
  END IF;

  -- Dr DISCOUNT
  INSERT INTO public.ledger_entries (tx_id, account_id, debit, credit, occurred_at, memo, month)
  VALUES (v_tx, v_disc_id, p_amount, 0, now(), COALESCE(p_memo,'Retro sibling discount'), p_month);

  -- Cr AR
  INSERT INTO public.ledger_entries (tx_id, account_id, debit, credit, occurred_at, memo, month)
  VALUES (v_tx, v_ar_id, 0, p_amount, now(), COALESCE(p_memo,'Retro sibling discount'), p_month);
END;
$$;

-- View for projected base per student (re-usable)
CREATE OR REPLACE VIEW public.v_projected_base AS
SELECT
  e.student_id,
  date_trunc('month', s.date)::date AS month_start,
  to_char(date_trunc('month', s.date), 'YYYY-MM') AS ym,
  COUNT(*)::int AS projected_sessions,
  COALESCE(SUM(c.session_rate_vnd),0)::int AS projected_base
FROM public.sessions s
JOIN public.enrollments e ON e.class_id = s.class_id
JOIN public.classes c ON c.id = s.class_id
WHERE s.status IN ('Scheduled','Held')
  AND e.start_date <= s.date
  AND (e.end_date IS NULL OR s.date <= e.end_date)
GROUP BY e.student_id, date_trunc('month', s.date);