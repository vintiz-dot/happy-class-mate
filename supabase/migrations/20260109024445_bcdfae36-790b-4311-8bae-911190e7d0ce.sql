-- Create early_submission_rewards table to track bonuses
CREATE TABLE early_submission_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES homework_submissions(id) ON DELETE SET NULL,
  points_awarded INT NOT NULL DEFAULT 5,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES auth.users(id),
  point_transaction_id UUID REFERENCES point_transactions(id),
  UNIQUE(homework_id, student_id)
);

-- Enable RLS
ALTER TABLE early_submission_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for early_submission_rewards
CREATE POLICY "Students can view their own early submission rewards"
  ON early_submission_rewards FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE linked_user_id = auth.uid()));

CREATE POLICY "Teachers can view early submission rewards for their classes"
  ON early_submission_rewards FOR SELECT
  USING (homework_id IN (
    SELECT h.id FROM homeworks h
    JOIN classes c ON h.class_id = c.id
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON s.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "System can insert early submission rewards"
  ON early_submission_rewards FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE linked_user_id = auth.uid()));

CREATE POLICY "Teachers can update early submission rewards"
  ON early_submission_rewards FOR UPDATE
  USING (homework_id IN (
    SELECT h.id FROM homeworks h
    JOIN classes c ON h.class_id = c.id
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON s.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  ));