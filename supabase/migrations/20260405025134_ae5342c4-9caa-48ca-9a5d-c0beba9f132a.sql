
-- Add economy fields to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS economy_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_to_cash_rate integer NOT NULL DEFAULT 50;

-- Add cash_on_hand to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS cash_on_hand integer NOT NULL DEFAULT 0;

-- Create enum types for economy transactions
DO $$ BEGIN
  CREATE TYPE public.economy_tx_type AS ENUM ('convert_to_cash', 'spend_cash', 'deposit_cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.economy_tx_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create economy_transactions table
CREATE TABLE IF NOT EXISTS public.economy_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  type public.economy_tx_type NOT NULL,
  points_impact integer NOT NULL DEFAULT 0,
  cash_impact integer NOT NULL DEFAULT 0,
  status public.economy_tx_status NOT NULL DEFAULT 'pending',
  processed_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_economy_tx_student ON public.economy_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_economy_tx_class ON public.economy_transactions(class_id);
CREATE INDEX IF NOT EXISTS idx_economy_tx_status ON public.economy_transactions(status);

-- Enable RLS
ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;

-- Students can view their own transactions
CREATE POLICY "Students view own economy transactions"
ON public.economy_transactions FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
  )
);

-- Students can create pending requests for classes they're enrolled in
CREATE POLICY "Students create economy requests"
ON public.economy_transactions FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
  )
  AND class_id IN (
    SELECT e.class_id FROM enrollments e WHERE e.student_id = economy_transactions.student_id AND e.end_date IS NULL
  )
);

-- Teachers/TAs can view transactions for their classes
CREATE POLICY "Staff view class economy transactions"
ON public.economy_transactions FOR SELECT
TO authenticated
USING (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Teachers/TAs can update (approve/reject) transactions
CREATE POLICY "Staff update economy transactions"
ON public.economy_transactions FOR UPDATE
TO authenticated
USING (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Admins can do everything
CREATE POLICY "Admins manage economy transactions"
ON public.economy_transactions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_economy_transactions_updated_at
BEFORE UPDATE ON public.economy_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_student_points_timestamp();
