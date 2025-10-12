-- Create discount definitions table
CREATE TABLE public.discount_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.discount_type NOT NULL,
  cadence public.discount_cadence NOT NULL,
  value INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT,
  amortize_yearly BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create discount assignments table (links discounts to students)
CREATE TABLE public.discount_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  discount_def_id UUID NOT NULL REFERENCES public.discount_definitions(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create referral bonuses table
CREATE TABLE public.referral_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type public.discount_type NOT NULL,
  cadence public.discount_cadence NOT NULL,
  value INTEGER NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_discount_assignments_student ON public.discount_assignments(student_id);
CREATE INDEX idx_discount_assignments_discount ON public.discount_assignments(discount_def_id);
CREATE INDEX idx_referral_bonuses_student ON public.referral_bonuses(student_id);

-- Create updated_at triggers
CREATE TRIGGER update_discount_definitions_updated_at
  BEFORE UPDATE ON public.discount_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discount_assignments_updated_at
  BEFORE UPDATE ON public.discount_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_bonuses_updated_at
  BEFORE UPDATE ON public.referral_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.discount_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_definitions
CREATE POLICY "Admins can manage discount definitions"
  ON public.discount_definitions
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All authenticated users can view active discounts"
  ON public.discount_definitions
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for discount_assignments
CREATE POLICY "Admins can manage discount assignments"
  ON public.discount_assignments
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their discount assignments"
  ON public.discount_assignments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family discount assignments"
  ON public.discount_assignments
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for referral_bonuses
CREATE POLICY "Admins can manage referral bonuses"
  ON public.referral_bonuses
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their referral bonuses"
  ON public.referral_bonuses
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family referral bonuses"
  ON public.referral_bonuses
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );