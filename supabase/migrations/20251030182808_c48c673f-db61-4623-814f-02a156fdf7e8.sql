-- Backfill notifications for existing homework and journals
-- Only backfill items from the last 30 days to avoid overwhelming users

-- Backfill homework assignment notifications
INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
SELECT DISTINCT 
  COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
  'homework_assigned' as type,
  'New Homework: ' || h.title as title,
  'New homework assigned in ' || c.name as message,
  jsonb_build_object(
    'homework_id', h.id,
    'class_id', h.class_id,
    'class_name', c.name,
    'due_date', h.due_date
  ) as metadata,
  h.created_at
FROM homeworks h
JOIN classes c ON c.id = h.class_id
JOIN enrollments e ON e.class_id = h.class_id
JOIN students s ON s.id = e.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE h.created_at > NOW() - INTERVAL '30 days'
  AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
  AND (e.end_date IS NULL OR e.end_date >= h.created_at::date)
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.type = 'homework_assigned'
      AND n.metadata->>'homework_id' = h.id::text
      AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  );

-- Backfill journal notifications for student journals
INSERT INTO notifications (user_id, journal_id, type, title, message, metadata, created_at)
SELECT DISTINCT
  COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
  j.id as journal_id,
  'new_journal' as type,
  'New journal entry for you: ' || j.title as title,
  'A new journal entry has been posted for you' as message,
  jsonb_build_object(
    'journal_type', j.type,
    'student_id', j.student_id
  ) as metadata,
  j.created_at
FROM journals j
JOIN students s ON s.id = j.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE j.type = 'student'
  AND j.created_at > NOW() - INTERVAL '30 days'
  AND NOT j.is_deleted
  AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
  AND j.owner_user_id != COALESCE(s.linked_user_id, f.primary_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.journal_id = j.id
      AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  );

-- Backfill journal notifications for class journals
INSERT INTO notifications (user_id, journal_id, type, title, message, metadata, created_at)
SELECT DISTINCT
  COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
  j.id as journal_id,
  'new_journal' as type,
  'New class journal: ' || j.title as title,
  'A new journal entry has been posted for your class' as message,
  jsonb_build_object(
    'journal_type', j.type,
    'class_id', j.class_id
  ) as metadata,
  j.created_at
FROM journals j
JOIN enrollments e ON e.class_id = j.class_id
JOIN students s ON s.id = e.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE j.type = 'class'
  AND j.created_at > NOW() - INTERVAL '30 days'
  AND NOT j.is_deleted
  AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
  AND (e.end_date IS NULL OR e.end_date >= j.created_at::date)
  AND j.owner_user_id != COALESCE(s.linked_user_id, f.primary_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.journal_id = j.id
      AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  );

-- Backfill journal notifications for collaborative journals (journal members)
INSERT INTO notifications (user_id, journal_id, type, title, message, metadata, created_at)
SELECT DISTINCT
  jm.user_id,
  j.id as journal_id,
  'new_journal' as type,
  'New collaborative journal: ' || j.title as title,
  'A new journal entry has been posted' as message,
  jsonb_build_object(
    'journal_type', j.type,
    'student_id', j.student_id,
    'class_id', j.class_id
  ) as metadata,
  j.created_at
FROM journals j
JOIN journal_members jm ON jm.journal_id = j.id
WHERE j.created_at > NOW() - INTERVAL '30 days'
  AND NOT j.is_deleted
  AND jm.user_id != j.owner_user_id
  AND jm.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.journal_id = j.id
      AND n.user_id = jm.user_id
  );