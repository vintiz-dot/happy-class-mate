-- Create function to notify students when homework is assigned
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

  -- Notify all enrolled students in the class
  FOR v_enrollment IN 
    SELECT DISTINCT s.linked_user_id, s.full_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.class_id = NEW.class_id
      AND s.linked_user_id IS NOT NULL
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_enrollment.linked_user_id,
      'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object(
        'homework_id', NEW.id,
        'class_id', NEW.class_id,
        'class_name', v_class_name,
        'due_date', NEW.due_date
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for homework assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_homework_assigned ON homeworks;
CREATE TRIGGER trigger_notify_homework_assigned
AFTER INSERT ON homeworks
FOR EACH ROW
EXECUTE FUNCTION notify_homework_assigned();

-- Create function to notify students when homework is graded
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  -- Only notify if grade was just added (changed from NULL to a value)
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    -- Get student's user_id
    SELECT s.linked_user_id INTO v_student_user_id
    FROM students s
    WHERE s.id = NEW.student_id;

    IF v_student_user_id IS NOT NULL THEN
      -- Get homework and class details
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h
      JOIN classes c ON c.id = h.class_id
      WHERE h.id = NEW.homework_id;

      -- Create notification
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
          'class_name', v_class_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for homework grading notifications
DROP TRIGGER IF EXISTS trigger_notify_homework_graded ON homework_submissions;
CREATE TRIGGER trigger_notify_homework_graded
AFTER UPDATE ON homework_submissions
FOR EACH ROW
EXECUTE FUNCTION notify_homework_graded();

-- Update the existing notify_journal_post function to work with students
CREATE OR REPLACE FUNCTION notify_journal_post()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_title TEXT;
  v_student_user_id UUID;
BEGIN
  -- Get journal type-specific title
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New journal entry for you: ' || NEW.title INTO v_title;
      -- Get student's user_id
      IF NEW.student_id IS NOT NULL THEN
        SELECT s.linked_user_id INTO v_student_user_id
        FROM students s
        WHERE s.id = NEW.student_id;
        
        -- Notify the student
        IF v_student_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
          VALUES (
            v_student_user_id,
            NEW.id,
            'new_journal',
            v_title,
            'A new journal entry has been posted for you',
            jsonb_build_object(
              'journal_type', NEW.type,
              'student_id', NEW.student_id
            )
          );
        END IF;
      END IF;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
      -- Notify all students in the class
      IF NEW.class_id IS NOT NULL THEN
        FOR v_member IN 
          SELECT DISTINCT s.linked_user_id
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          WHERE e.class_id = NEW.class_id
            AND s.linked_user_id IS NOT NULL
            AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
        LOOP
          IF v_member.linked_user_id != NEW.owner_user_id THEN
            INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
            VALUES (
              v_member.linked_user_id,
              NEW.id,
              'new_journal',
              v_title,
              'A new journal entry has been posted for your class',
              jsonb_build_object(
                'journal_type', NEW.type,
                'class_id', NEW.class_id
              )
            );
          END IF;
        END LOOP;
      END IF;
    WHEN 'collaborative' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;

  -- Notify all journal members except the creator (for collaborative journals)
  FOR v_member IN 
    SELECT user_id 
    FROM journal_members 
    WHERE journal_id = NEW.id 
      AND user_id != NEW.owner_user_id
      AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
    VALUES (
      v_member.user_id,
      NEW.id,
      'new_journal',
      v_title,
      'A new journal entry has been posted',
      jsonb_build_object(
        'journal_type', NEW.type,
        'student_id', NEW.student_id,
        'class_id', NEW.class_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;