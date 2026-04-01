-- Update is_teacher_of_class to also recognize Teaching Assistants
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(user_id uuid, class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Check if user is a lead teacher for sessions in this class
    SELECT 1 FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE s.class_id = is_teacher_of_class.class_id
    AND t.user_id = is_teacher_of_class.user_id
  )
  OR EXISTS (
    -- Check if user is a TA assigned to sessions in this class
    SELECT 1 FROM public.session_participants sp
    JOIN public.sessions s ON s.id = sp.session_id
    JOIN public.teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE s.class_id = is_teacher_of_class.class_id
    AND ta.user_id = is_teacher_of_class.user_id
    AND sp.participant_type = 'teaching_assistant'
  );
$function$;