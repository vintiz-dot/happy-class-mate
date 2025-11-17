-- Phase 1: Add enrollment rate override
ALTER TABLE enrollments 
ADD COLUMN rate_override_vnd INTEGER;

COMMENT ON COLUMN enrollments.rate_override_vnd IS 
'Per-student session rate override. If set, overrides class default rate for this enrollment.';

-- Phase 2: Add invoice confirmation fields
ALTER TABLE invoices 
ADD COLUMN confirmation_status TEXT DEFAULT 'needs_review' 
  CHECK (confirmation_status IN ('auto_approved', 'needs_review', 'confirmed', 'adjusted')),
ADD COLUMN review_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN confirmation_notes TEXT,
ADD COLUMN confirmed_at TIMESTAMPTZ,
ADD COLUMN confirmed_by UUID REFERENCES auth.users(id);

CREATE INDEX idx_invoices_confirmation_status ON invoices(confirmation_status);
CREATE INDEX idx_invoices_review_flags ON invoices USING gin(review_flags);

COMMENT ON COLUMN invoices.confirmation_status IS 
'auto_approved: Simple case, no review needed
needs_review: Has discounts or anomalies, requires admin review
confirmed: Admin reviewed and confirmed
adjusted: Admin made adjustments';

COMMENT ON COLUMN invoices.review_flags IS 
'Array of reason objects: [{type: "has_special_discount", label: "Special Discount Applied", details: {...}}]';

-- Phase 3: Create tuition review sessions table for audit
CREATE TABLE tuition_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID REFERENCES auth.users(id),
  month TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  students_reviewed INTEGER DEFAULT 0,
  students_confirmed INTEGER DEFAULT 0,
  students_adjusted INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE tuition_review_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tuition_review_sessions
CREATE POLICY "Admins can manage review sessions"
  ON tuition_review_sessions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));