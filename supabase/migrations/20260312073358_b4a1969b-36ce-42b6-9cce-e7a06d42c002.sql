
-- Create enrollment_requests table
CREATE TABLE public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid
);

-- Enable RLS
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Students can insert their own requests
CREATE POLICY "Students can insert own enrollment requests"
ON public.enrollment_requests FOR INSERT TO authenticated
WITH CHECK (can_view_student(student_id, auth.uid()));

-- Students can view their own requests
CREATE POLICY "Students can view own enrollment requests"
ON public.enrollment_requests FOR SELECT TO authenticated
USING (can_view_student(student_id, auth.uid()));

-- Admins can manage all requests
CREATE POLICY "Admins can manage enrollment requests"
ON public.enrollment_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to notify admins when a request is created
CREATE OR REPLACE FUNCTION public.notify_admin_enrollment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
  student_name text;
  class_name text;
BEGIN
  SELECT full_name INTO student_name FROM students WHERE id = NEW.student_id;
  SELECT name INTO class_name FROM classes WHERE id = NEW.class_id;

  FOR admin_row IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      admin_row.user_id,
      'enrollment_request',
      'New Enrollment Request',
      student_name || ' wants to join ' || class_name,
      jsonb_build_object('request_id', NEW.id, 'student_id', NEW.student_id, 'class_id', NEW.class_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_enrollment_request_created
AFTER INSERT ON public.enrollment_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_enrollment_request();
