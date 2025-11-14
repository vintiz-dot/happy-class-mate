-- Fix 1: Correct Cat's misallocated points (from Neptune to Jupiter)
-- Cat's student_id: 9fbb123c-781b-498e-8c4c-032361095188
-- Jupiter class_id: 18dab237-8295-4bae-96d0-e3dfcfc90a41
-- Neptune class_id: 7cdf9773-e10a-4f8a-9b48-7321e348bff2

UPDATE point_transactions
SET class_id = '18dab237-8295-4bae-96d0-e3dfcfc90a41'  -- Jupiter
WHERE student_id = '9fbb123c-781b-498e-8c4c-032361095188'
  AND class_id = '7cdf9773-e10a-4f8a-9b48-7321e348bff2';  -- Neptune

-- Rebuild student_points for affected student and classes
DELETE FROM student_points
WHERE (student_id = '9fbb123c-781b-498e-8c4c-032361095188' 
  AND class_id IN ('18dab237-8295-4bae-96d0-e3dfcfc90a41', '7cdf9773-e10a-4f8a-9b48-7321e348bff2'));

INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id, class_id, month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
WHERE student_id = '9fbb123c-781b-498e-8c4c-032361095188'
  AND class_id IN ('18dab237-8295-4bae-96d0-e3dfcfc90a41', '7cdf9773-e10a-4f8a-9b48-7321e348bff2')
GROUP BY student_id, class_id, month;

-- Fix 2: Update modify_enrollment_transfer to transfer points when students change classes
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
  v_points_transferred INT := 0;
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

  -- 3. Transfer point_transactions to new class for current and future months
  WITH transferred AS (
    UPDATE point_transactions
    SET 
      class_id = p_new_class_id,
      notes = COALESCE(notes, '') || ' [Transferred from previous class]'
    WHERE student_id = p_student_id
      AND class_id = p_old_class_id
      AND month >= v_effective_month
    RETURNING id
  )
  SELECT count(*) INTO v_points_transferred FROM transferred;

  -- 4. Rebuild student_points for both classes (all affected months)
  DELETE FROM student_points
  WHERE student_id = p_student_id
    AND class_id IN (p_old_class_id, p_new_class_id)
    AND month >= v_effective_month;

  INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
  SELECT 
    student_id, class_id, month,
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0)
  FROM point_transactions
  WHERE student_id = p_student_id
    AND class_id IN (p_old_class_id, p_new_class_id)
    AND month >= v_effective_month
  GROUP BY student_id, class_id, month
  ON CONFLICT (student_id, class_id, month) 
  DO UPDATE SET
    homework_points = EXCLUDED.homework_points,
    participation_points = EXCLUDED.participation_points,
    updated_at = now();

  -- 5. Create new enrollment
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

  -- 6. Seed attendance for future sessions in new class
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

  -- 7. Audit log
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
      'seeded_attendance', v_seeded_count,
      'points_transferred', v_points_transferred
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_enrollment_id', v_old_enrollment_id,
    'new_enrollment_id', v_new_enrollment_id,
    'deleted_future_attendance', v_deleted_count,
    'seeded_attendance', v_seeded_count,
    'points_transferred', v_points_transferred,
    'effective_month', v_effective_month,
    'next_month', v_next_month
  );
END;
$$;