-- Add allowed_days column to enrollments table
-- NULL = all days (default behavior, backwards compatible)
-- Array of integers representing day of week (0=Sunday, 1=Monday, 2=Tuesday, etc.)
-- Example: [2] = Tuesday only, [2, 6] = Tuesday and Saturday

ALTER TABLE public.enrollments ADD COLUMN allowed_days integer[] DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.enrollments.allowed_days IS 'Array of weekday numbers (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat) the student attends. NULL means all days.';