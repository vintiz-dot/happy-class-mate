-- Create payroll summary table
CREATE TABLE public.payroll_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  total_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(teacher_id, month)
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  diff JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payroll_summaries_teacher ON public.payroll_summaries(teacher_id);
CREATE INDEX idx_payroll_summaries_month ON public.payroll_summaries(month);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_occurred ON public.audit_log(occurred_at);

-- Enable RLS
ALTER TABLE public.payroll_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_summaries
CREATE POLICY "Admins can manage payroll summaries"
  ON public.payroll_summaries
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view their own payroll"
  ON public.payroll_summaries
  FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for audit_log
CREATE POLICY "Admins can view audit log"
  ON public.audit_log
  FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');