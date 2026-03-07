
-- Fix validate_status_message
CREATE OR REPLACE FUNCTION public.validate_status_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.status_message IS NOT NULL AND length(NEW.status_message) > 50 THEN
    RAISE EXCEPTION 'status_message must be 50 characters or fewer';
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_homework_assigned
CREATE OR REPLACE FUNCTION public.notify_homework_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_enrollment RECORD;
  v_class_name TEXT;
BEGIN
  SELECT name INTO v_class_name FROM classes WHERE id = NEW.class_id;
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
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_enrollment.user_id, 'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object('homework_id', NEW.id, 'class_id', NEW.class_id, 'class_name', v_class_name, 'due_date', NEW.due_date, 'student_id', v_enrollment.student_id)
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Fix notify_teacher_homework_submission
CREATE OR REPLACE FUNCTION public.notify_teacher_homework_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
  v_teacher_user_id uuid;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    SELECT h.*, c.name as class_name, c.default_teacher_id INTO v_homework
    FROM homeworks h JOIN classes c ON c.id = h.class_id WHERE h.id = NEW.homework_id;
    SELECT full_name INTO v_student FROM students WHERE id = NEW.student_id;
    SELECT teacher_id INTO v_teacher_id FROM sessions WHERE class_id = v_homework.class_id ORDER BY date DESC LIMIT 1;
    IF v_teacher_id IS NOT NULL THEN
      SELECT user_id INTO v_teacher_user_id FROM teachers WHERE id = v_teacher_id;
      IF v_teacher_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, metadata)
        VALUES (v_teacher_user_id, 'homework_submitted', 'New Homework Submission',
          v_student.full_name || ' submitted homework for ' || v_homework.class_name,
          jsonb_build_object('student_id', NEW.student_id, 'student_name', v_student.full_name, 'homework_id', NEW.homework_id, 'homework_title', v_homework.title, 'class_id', v_homework.class_id, 'class_name', v_homework.class_name, 'submission_id', NEW.id));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_homework_graded
CREATE OR REPLACE FUNCTION public.notify_homework_graded()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
    FROM students s LEFT JOIN families f ON s.family_id = f.id WHERE s.id = NEW.student_id;
    IF v_student_user_id IS NOT NULL THEN
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h JOIN classes c ON c.id = h.class_id WHERE h.id = NEW.homework_id;
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (v_student_user_id, 'homework_graded', 'Homework Graded: ' || v_homework_title,
        'Your homework has been graded in ' || v_class_name,
        jsonb_build_object('homework_id', NEW.homework_id, 'submission_id', NEW.id, 'grade', NEW.grade, 'class_name', v_class_name, 'student_id', NEW.student_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_journal_collaboration
CREATE OR REPLACE FUNCTION public.notify_journal_collaboration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  journal_title text;
  journal_owner_id uuid;
BEGIN
  SELECT title, owner_user_id INTO journal_title, journal_owner_id FROM journals WHERE id = NEW.journal_id;
  IF NEW.role IN ('editor', 'viewer') THEN
    INSERT INTO notifications (user_id, type, title, message, journal_id, metadata)
    VALUES (NEW.user_id, 'journal_collaboration', 'Journal Collaboration Invitation',
      'You have been invited to collaborate on journal: ' || journal_title,
      NEW.journal_id, jsonb_build_object('role', NEW.role, 'invited_by', journal_owner_id));
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_journal_post
CREATE OR REPLACE FUNCTION public.notify_journal_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_member RECORD;
  v_title TEXT;
  v_student_user_id UUID;
BEGIN
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New journal entry for you: ' || NEW.title INTO v_title;
      IF NEW.student_id IS NOT NULL THEN
        SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
        FROM students s LEFT JOIN families f ON s.family_id = f.id WHERE s.id = NEW.student_id;
        IF v_student_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
          VALUES (v_student_user_id, NEW.id, 'new_journal', v_title, 'A new journal entry has been posted for you',
            jsonb_build_object('journal_type', NEW.type, 'student_id', NEW.student_id));
        END IF;
      END IF;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
      IF NEW.class_id IS NOT NULL THEN
        FOR v_member IN 
          SELECT DISTINCT COALESCE(s.linked_user_id, f.primary_user_id) as user_id
          FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN families f ON s.family_id = f.id
          WHERE e.class_id = NEW.class_id AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
            AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
        LOOP
          IF v_member.user_id != NEW.owner_user_id THEN
            INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
            VALUES (v_member.user_id, NEW.id, 'new_journal', v_title, 'A new journal entry has been posted for your class',
              jsonb_build_object('journal_type', NEW.type, 'class_id', NEW.class_id));
          END IF;
        END LOOP;
      END IF;
    WHEN 'collab_student_teacher' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;
  FOR v_member IN 
    SELECT user_id FROM journal_members WHERE journal_id = NEW.id AND user_id != NEW.owner_user_id AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
    VALUES (v_member.user_id, NEW.id, 'new_journal', v_title, 'A new journal entry has been posted',
      jsonb_build_object('journal_type', NEW.type, 'student_id', NEW.student_id, 'class_id', NEW.class_id));
  END LOOP;
  RETURN NEW;
END;
$function$;
