-- Fix security definer functions missing search_path
-- This addresses the function_search_path_mutable security warning

-- Fix notify_teacher_homework_submission function
CREATE OR REPLACE FUNCTION public.notify_teacher_homework_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
  v_teacher_user_id uuid;
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
    
    -- Get teacher's user_id
    IF v_teacher_id IS NOT NULL THEN
      SELECT user_id INTO v_teacher_user_id
      FROM teachers
      WHERE id = v_teacher_id;
      
      -- Create notification for the teacher
      IF v_teacher_user_id IS NOT NULL THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          metadata
        ) VALUES (
          v_teacher_user_id,
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix notify_journal_collaboration function
CREATE OR REPLACE FUNCTION public.notify_journal_collaboration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  journal_title text;
  journal_owner_id uuid;
BEGIN
  -- Get journal info
  SELECT title, owner_user_id INTO journal_title, journal_owner_id
  FROM journals WHERE id = NEW.journal_id;

  -- Create notification for the invited teacher
  IF NEW.role IN ('editor', 'viewer') THEN
    INSERT INTO notifications (user_id, type, title, message, journal_id, metadata)
    VALUES (
      NEW.user_id,
      'journal_collaboration',
      'Journal Collaboration Invitation',
      'You have been invited to collaborate on journal: ' || journal_title,
      NEW.journal_id,
      jsonb_build_object('role', NEW.role, 'invited_by', journal_owner_id)
    );
  END IF;

  RETURN NEW;
END;
$$;