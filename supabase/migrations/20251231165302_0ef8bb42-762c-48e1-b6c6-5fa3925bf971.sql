-- Drop the old constraint and add new one that includes 'focus'
ALTER TABLE skill_assessments DROP CONSTRAINT skill_assessments_skill_check;

ALTER TABLE skill_assessments ADD CONSTRAINT skill_assessments_skill_check 
CHECK (skill = ANY (ARRAY['reading'::text, 'writing'::text, 'listening'::text, 'speaking'::text, 'teamwork'::text, 'personal'::text, 'focus'::text]));

-- Backfill focus points from point_transactions to skill_assessments
INSERT INTO skill_assessments (student_id, class_id, session_id, skill, score, date, created_by, teacher_comment)
SELECT 
  pt.student_id,
  pt.class_id,
  pt.session_id,
  'focus' as skill,
  pt.points as score,
  pt.date,
  pt.created_by,
  pt.notes as teacher_comment
FROM point_transactions pt
WHERE pt.type = 'participation' 
  AND pt.notes ILIKE '%focus%'
  AND NOT EXISTS (
    SELECT 1 FROM skill_assessments sa 
    WHERE sa.student_id = pt.student_id 
      AND sa.class_id = pt.class_id 
      AND sa.date = pt.date 
      AND sa.skill = 'focus'
      AND sa.score = pt.points
  );

-- Backfill teamwork points from point_transactions to skill_assessments
INSERT INTO skill_assessments (student_id, class_id, session_id, skill, score, date, created_by, teacher_comment)
SELECT 
  pt.student_id,
  pt.class_id,
  pt.session_id,
  'teamwork' as skill,
  pt.points as score,
  pt.date,
  pt.created_by,
  pt.notes as teacher_comment
FROM point_transactions pt
WHERE pt.type = 'participation'
  AND pt.notes ILIKE '%teamwork%'
  AND NOT EXISTS (
    SELECT 1 FROM skill_assessments sa 
    WHERE sa.student_id = pt.student_id 
      AND sa.class_id = pt.class_id 
      AND sa.date = pt.date 
      AND sa.skill = 'teamwork'
      AND sa.score = pt.points
  );