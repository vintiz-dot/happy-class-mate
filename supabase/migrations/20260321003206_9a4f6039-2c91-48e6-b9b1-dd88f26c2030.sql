
-- Add class metadata columns
ALTER TABLE classes ADD COLUMN IF NOT EXISTS curriculum text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS age_range text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS visibility_settings jsonb DEFAULT '{"curriculum": true, "age_range": true, "description": true, "teacher_info": true}'::jsonb;

-- Trigger: when a session is cancelled, set attendance to Excused
CREATE OR REPLACE FUNCTION set_attendance_excused_on_cancel()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Canceled' AND (OLD.status IS DISTINCT FROM 'Canceled') THEN
    UPDATE attendance SET status = 'Excused'
    WHERE session_id = NEW.id AND status = 'Present';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cancel_session_excused ON sessions;
CREATE TRIGGER trg_cancel_session_excused
AFTER UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION set_attendance_excused_on_cancel();
