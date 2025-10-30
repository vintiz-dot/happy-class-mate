-- Update notification triggers to include student_id in metadata for filtering
-- This allows siblings to only see their own notifications

-- Update homework assignment notification to include student_id
CREATE OR REPLACE FUNCTION notify_homework_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment RECORD;
  v_class_name TEXT;
BEGIN
  -- Get class name
  SELECT name INTO v_class_name
  FROM classes
  WHERE id = NEW.class_id;

  -- Notify each enrolled student individually with their student_id in metadata
  FOR v_enrollment IN 
    SELECT DISTINCT 
      s.id as student_id,
      COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
      s.full_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN families f ON s.family_id = f.id
    WHERE e.class_id = NEW.class_id
      AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_enrollment.user_id,
      'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object(
        'homework_id', NEW.id,
        'class_id', NEW.class_id,
        'class_name', v_class_name,
        'due_date', NEW.due_date,
        'student_id', v_enrollment.student_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update homework grading notification to include student_id
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  -- Only notify if grade was just added (changed from NULL to a value)
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    -- Get student's user_id (either direct or through family)
    SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
    FROM students s
    LEFT JOIN families f ON s.family_id = f.id
    WHERE s.id = NEW.student_id;

    IF v_student_user_id IS NOT NULL THEN
      -- Get homework and class details
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h
      JOIN classes c ON c.id = h.class_id
      WHERE h.id = NEW.homework_id;

      -- Create notification with student_id in metadata
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_student_user_id,
        'homework_graded',
        'Homework Graded: ' || v_homework_title,
        'Your homework has been graded in ' || v_class_name,
        jsonb_build_object(
          'homework_id', NEW.homework_id,
          'submission_id', NEW.id,
          'grade', NEW.grade,
          'class_name', v_class_name,
          'student_id', NEW.student_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;