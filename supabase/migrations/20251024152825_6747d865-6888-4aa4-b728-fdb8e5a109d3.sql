-- Create payment_deletions table for audit trail
CREATE TABLE IF NOT EXISTS public.payment_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  deleted_by UUID REFERENCES auth.users(id),
  deletion_reason TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_deletions ENABLE ROW LEVEL SECURITY;

-- Only admins can view deletion history
CREATE POLICY "Admins can view payment deletions"
  ON public.payment_deletions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create trigger to block direct payment deletion from client
CREATE OR REPLACE FUNCTION public.prevent_direct_payment_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow deletion only from service role (edge functions)
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Direct payment deletion is not allowed. Use the delete-payment edge function instead.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_client_payment_deletion
  BEFORE DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_payment_deletion();