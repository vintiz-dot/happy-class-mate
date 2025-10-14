-- Create expenditures table for admin finance tracking
CREATE TABLE IF NOT EXISTS public.expenditures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  memo TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage expenditures"
ON public.expenditures
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_expenditures_updated_at
  BEFORE UPDATE ON public.expenditures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();