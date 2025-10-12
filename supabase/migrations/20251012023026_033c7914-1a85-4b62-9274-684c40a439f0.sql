-- Fix infinite recursion in RLS policies by creating security definer functions

-- Function to check if user can view student
CREATE OR REPLACE FUNCTION public.can_view_student(student_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id
    AND (
      s.linked_user_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = s.family_id
        AND f.primary_user_id = user_id
      )
    )
  );
$$;

-- Drop and recreate policies for ledger_accounts
DROP POLICY IF EXISTS "Students can view their ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Family users can view family ledger accounts" ON public.ledger_accounts;

CREATE POLICY "Students can view their ledger accounts"
  ON public.ledger_accounts
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for ledger_entries
DROP POLICY IF EXISTS "Students can view their ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Family users can view family ledger entries" ON public.ledger_entries;

CREATE POLICY "Students can view their ledger entries"
  ON public.ledger_entries
  FOR SELECT
  USING (
    account_id IN (
      SELECT la.id FROM public.ledger_accounts la
      WHERE public.can_view_student(la.student_id, auth.uid())
    )
  );

-- Drop and recreate policies for invoices
DROP POLICY IF EXISTS "Students can view their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Family users can view family invoices" ON public.invoices;

CREATE POLICY "Students can view their invoices"
  ON public.invoices
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for payments
DROP POLICY IF EXISTS "Students can view their payments" ON public.payments;
DROP POLICY IF EXISTS "Family users can view family payments" ON public.payments;

CREATE POLICY "Students can view their payments"
  ON public.payments
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for discount_assignments
DROP POLICY IF EXISTS "Students can view their discount assignments" ON public.discount_assignments;
DROP POLICY IF EXISTS "Family users can view family discount assignments" ON public.discount_assignments;

CREATE POLICY "Students can view their discount assignments"
  ON public.discount_assignments
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for referral_bonuses
DROP POLICY IF EXISTS "Students can view their referral bonuses" ON public.referral_bonuses;
DROP POLICY IF EXISTS "Family users can view family referral bonuses" ON public.referral_bonuses;

CREATE POLICY "Students can view their referral bonuses"
  ON public.referral_bonuses
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));