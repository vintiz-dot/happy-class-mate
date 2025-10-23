-- Fix modify_enrollment_transfer to delete ALL attendance in old class (not just future)
-- This prevents billing transferred students for past sessions in the old class

CREATE OR REPLACE FUNCTION public.modify_enrollment_transfer(
  p_student_id UUID,
  p_old_class_id UUID,
  p_new_class_id UUID,
  p_effective_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_enrollment_id UUID;
  v_new_enrollment_id UUID;
  v_deleted_count INT := 0;
  v_seeded_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
  v_next_month TEXT;
BEGIN
  -- Validate dates
  v_effective_month := to_char(p_effective_date, 'YYYY-MM');
  v_next_month := to_char(p_effective_date + INTERVAL '1 month', 'YYYY-MM');

  -- Get old enrollment
  SELECT id INTO v_old_enrollment_id
  FROM enrollments
  WHERE student_id = p_student_id 
    AND class_id = p_old_class_id
    AND (end_date IS NULL OR end_date >= p_effective_date);

  IF v_old_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Active enrollment not found for student % in class %', p_student_id, p_old_class_id;
  END IF;

  -- 1. End old enrollment (set end_date to day before transfer)
  UPDATE enrollments
  SET 
    end_date = p_effective_date - INTERVAL '1 day',
    updated_at = now(),
    updated_by = v_actor_id
  WHERE id = v_old_enrollment_id;

  -- 2. Delete ALL attendance rows in old class (past and future)
  -- This prevents billing for past sessions after transfer
  WITH deleted AS (
    DELETE FROM attendance
    WHERE student_id = p_student_id
      AND session_id IN (
        SELECT id FROM sessions 
        WHERE class_id = p_old_class_id
      )
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  -- 3. Create new enrollment
  INSERT INTO enrollments (
    student_id,
    class_id,
    start_date,
    created_by,
    updated_by
  ) VALUES (
    p_student_id,
    p_new_class_id,
    p_effective_date,
    v_actor_id,
    v_actor_id
  )
  RETURNING id INTO v_new_enrollment_id;

  -- 4. Seed attendance for future sessions in new class
  WITH seeded AS (
    INSERT INTO attendance (session_id, student_id, status, marked_by)
    SELECT s.id, p_student_id, 'Present', NULL
    FROM sessions s
    WHERE s.class_id = p_new_class_id
      AND s.date >= p_effective_date
      AND s.status != 'Canceled'
    ON CONFLICT (session_id, student_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_seeded_count FROM seeded;

  -- 5. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'transfer',
    'enrollment',
    v_old_enrollment_id::text,
    jsonb_build_object(
      'old_class_id', p_old_class_id,
      'new_class_id', p_new_class_id,
      'effective_date', p_effective_date,
      'deleted_attendance', v_deleted_count,
      'seeded_attendance', v_seeded_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_enrollment_id', v_old_enrollment_id,
    'new_enrollment_id', v_new_enrollment_id,
    'deleted_future_attendance', v_deleted_count,
    'seeded_attendance', v_seeded_count,
    'effective_month', v_effective_month,
    'next_month', v_next_month
  );
END;
$$;