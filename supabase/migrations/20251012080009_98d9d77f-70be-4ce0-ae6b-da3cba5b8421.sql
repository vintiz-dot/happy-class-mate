-- Create sibling discount state tracking table
CREATE TABLE IF NOT EXISTS public.sibling_discount_state (
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  month text NOT NULL,
  status text NOT NULL CHECK (status IN ('assigned','pending','none')),
  winner_student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  sibling_percent int NOT NULL,
  reason text NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, month)
);

-- RLS policies
ALTER TABLE public.sibling_discount_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sibling discount state"
  ON public.sibling_discount_state
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view family sibling state"
  ON public.sibling_discount_state
  FOR SELECT
  USING (
    family_id IN (
      SELECT s.family_id 
      FROM students s 
      WHERE can_view_student(s.id, auth.uid())
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sibling_discount_state_family_month 
  ON public.sibling_discount_state(family_id, month);

CREATE INDEX IF NOT EXISTS idx_sibling_discount_state_winner 
  ON public.sibling_discount_state(winner_student_id) 
  WHERE winner_student_id IS NOT NULL;