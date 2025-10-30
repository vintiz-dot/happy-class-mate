-- Fix the notify_journal_post trigger to use correct enum value
CREATE OR REPLACE FUNCTION public.notify_journal_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHEN 'collab_student_teacher' THEN
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
$function$;