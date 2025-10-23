-- Enrollment modifications with proration and pause windows
-- All times in Asia/Bangkok

-- 1. Create pause_windows table to track enrollment pauses
CREATE TABLE IF NOT EXISTS public.pause_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  memo TEXT,
  CONSTRAINT valid_pause_dates CHECK (to_date >= from_date)
);

-- Enable RLS on pause_windows
ALTER TABLE public.pause_windows ENABLE ROW LEVEL SECURITY;

-- RLS policies for pause_windows
CREATE POLICY "Admins can manage pause windows"
  ON public.pause_windows FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view pause windows for their classes"
  ON public.pause_windows FOR SELECT
  USING (
    class_id IN (
      SELECT DISTINCT s.class_id
      FROM sessions s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own pause windows"
  ON public.pause_windows FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

-- Index for performance
CREATE INDEX idx_pause_windows_student_class ON public.pause_windows(student_id, class_id);
CREATE INDEX idx_pause_windows_dates ON public.pause_windows(from_date, to_date);

-- 2. RPC: Transfer enrollment to another class
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

  -- 2. Delete future attendance rows in old class (date >= effective_date)
  WITH deleted AS (
    DELETE FROM attendance
    WHERE student_id = p_student_id
      AND session_id IN (
        SELECT id FROM sessions 
        WHERE class_id = p_old_class_id 
          AND date >= p_effective_date
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

-- 3. RPC: Pause enrollment
CREATE OR REPLACE FUNCTION public.pause_enrollment(
  p_student_id UUID,
  p_class_id UUID,
  p_from_date DATE,
  p_to_date DATE,
  p_memo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pause_window_id UUID;
  v_excused_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
BEGIN
  -- Validate dates
  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'to_date must be >= from_date';
  END IF;

  v_effective_month := to_char(p_from_date, 'YYYY-MM');

  -- 1. Create pause window record
  INSERT INTO pause_windows (
    student_id,
    class_id,
    from_date,
    to_date,
    memo,
    created_by
  ) VALUES (
    p_student_id,
    p_class_id,
    p_from_date,
    p_to_date,
    p_memo,
    v_actor_id
  )
  RETURNING id INTO v_pause_window_id;

  -- 2. Mark attendance as Excused for sessions in pause window
  WITH excused AS (
    INSERT INTO attendance (session_id, student_id, status, marked_by, notes)
    SELECT 
      s.id, 
      p_student_id, 
      'Excused', 
      v_actor_id,
      'Pause: ' || COALESCE(p_memo, 'Student paused')
    FROM sessions s
    WHERE s.class_id = p_class_id
      AND s.date BETWEEN p_from_date AND p_to_date
      AND s.status != 'Canceled'
    ON CONFLICT (session_id, student_id) 
    DO UPDATE SET 
      status = 'Excused',
      marked_by = v_actor_id,
      notes = 'Pause: ' || COALESCE(p_memo, 'Student paused'),
      updated_at = now()
    RETURNING id
  )
  SELECT count(*) INTO v_excused_count FROM excused;

  -- 3. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'pause',
    'enrollment',
    v_pause_window_id::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'class_id', p_class_id,
      'from_date', p_from_date,
      'to_date', p_to_date,
      'excused_count', v_excused_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'pause_window_id', v_pause_window_id,
    'excused_attendance', v_excused_count,
    'effective_month', v_effective_month
  );
END;
$$;

-- 4. RPC: End enrollment
CREATE OR REPLACE FUNCTION public.end_enrollment(
  p_student_id UUID,
  p_class_id UUID,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_deleted_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
BEGIN
  v_effective_month := to_char(p_end_date, 'YYYY-MM');

  -- Get enrollment
  SELECT id INTO v_enrollment_id
  FROM enrollments
  WHERE student_id = p_student_id 
    AND class_id = p_class_id
    AND (end_date IS NULL OR end_date > p_end_date);

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Active enrollment not found for student % in class %', p_student_id, p_class_id;
  END IF;

  -- 1. Set enrollment end_date
  UPDATE enrollments
  SET 
    end_date = p_end_date,
    updated_at = now(),
    updated_by = v_actor_id
  WHERE id = v_enrollment_id;

  -- 2. Delete future attendance rows (date > end_date)
  WITH deleted AS (
    DELETE FROM attendance
    WHERE student_id = p_student_id
      AND session_id IN (
        SELECT id FROM sessions 
        WHERE class_id = p_class_id 
          AND date > p_end_date
      )
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  -- 3. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'end',
    'enrollment',
    v_enrollment_id::text,
    jsonb_build_object(
      'end_date', p_end_date,
      'deleted_attendance', v_deleted_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'deleted_future_attendance', v_deleted_count,
    'effective_month', v_effective_month
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.modify_enrollment_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_enrollment TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_enrollment TO authenticated;