-- Create teacher_banking_info table
CREATE TABLE IF NOT EXISTS public.teacher_banking_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  swift_code TEXT,
  branch_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(teacher_id)
);

-- Enable RLS
ALTER TABLE public.teacher_banking_info ENABLE ROW LEVEL SECURITY;

-- Admins can manage all banking info
CREATE POLICY "Admins can manage banking info"
  ON public.teacher_banking_info
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view and update their own banking info
CREATE POLICY "Teachers can view own banking info"
  ON public.teacher_banking_info
  FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update own banking info"
  ON public.teacher_banking_info
  FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert own banking info"
  ON public.teacher_banking_info
  FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_teacher_banking_info_updated_at
  BEFORE UPDATE ON public.teacher_banking_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_teacher_banking_info_teacher_id ON public.teacher_banking_info(teacher_id);