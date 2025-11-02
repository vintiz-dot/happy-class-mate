-- Fix search_path for notify_teacher_homework_submission function
DROP TRIGGER IF EXISTS trigger_notify_teacher_homework_submission ON homework_submissions;
DROP FUNCTION IF EXISTS notify_teacher_homework_submission();

CREATE OR REPLACE FUNCTION notify_teacher_homework_submission()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
BEGIN
  -- Only notify on new submissions or status changes to submitted
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    
    -- Get homework and class details
    SELECT h.*, c.name as class_name, c.default_teacher_id
    INTO v_homework
    FROM homeworks h
    JOIN classes c ON c.id = h.class_id
    WHERE h.id = NEW.homework_id;
    
    -- Get student details
    SELECT full_name INTO v_student
    FROM students
    WHERE id = NEW.student_id;
    
    -- Get teacher from a recent session for this class
    SELECT teacher_id INTO v_teacher_id
    FROM sessions
    WHERE class_id = v_homework.class_id
    ORDER BY date DESC
    LIMIT 1;
    
    -- Create notification for the teacher
    IF v_teacher_id IS NOT NULL THEN
      INSERT INTO notifications (
        type,
        title,
        message,
        metadata
      ) VALUES (
        'homework_submitted',
        'New Homework Submission',
        v_student.full_name || ' submitted homework for ' || v_homework.class_name,
        jsonb_build_object(
          'student_id', NEW.student_id,
          'student_name', v_student.full_name,
          'homework_id', NEW.homework_id,
          'homework_title', v_homework.title,
          'class_id', v_homework.class_id,
          'class_name', v_homework.class_name,
          'submission_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_notify_teacher_homework_submission
  AFTER INSERT OR UPDATE ON homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_homework_submission();