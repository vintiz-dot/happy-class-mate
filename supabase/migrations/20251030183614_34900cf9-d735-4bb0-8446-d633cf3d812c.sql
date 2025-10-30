-- Backfill student_id in existing notification metadata
-- Update homework_assigned notifications
UPDATE notifications n
SET metadata = jsonb_set(
  COALESCE(n.metadata, '{}'::jsonb),
  '{student_id}',
  to_jsonb(e.student_id)
)
FROM homeworks h
JOIN enrollments e ON e.class_id = h.class_id
JOIN students s ON s.id = e.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE n.type = 'homework_assigned'
  AND n.metadata->>'homework_id' = h.id::text
  AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  AND n.metadata->>'student_id' IS NULL;

-- Update homework_graded notifications
UPDATE notifications n
SET metadata = jsonb_set(
  COALESCE(n.metadata, '{}'::jsonb),
  '{student_id}',
  to_jsonb(hs.student_id)
)
FROM homework_submissions hs
WHERE n.type = 'homework_graded'
  AND n.metadata->>'submission_id' = hs.id::text
  AND n.metadata->>'student_id' IS NULL;