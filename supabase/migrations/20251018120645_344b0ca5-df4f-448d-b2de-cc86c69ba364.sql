-- Add constraint to prevent overlapping discount assignments for the same student+definition
-- Using exclusion constraint with daterange
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.discount_assignments 
ADD CONSTRAINT no_overlapping_assignments 
EXCLUDE USING gist (
  student_id WITH =,
  discount_def_id WITH =,
  daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
);

-- Ensure audit_log table exists with proper structure
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  diff jsonb,
  actor_user_id uuid REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Add index for better audit query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred ON public.audit_log(occurred_at DESC);