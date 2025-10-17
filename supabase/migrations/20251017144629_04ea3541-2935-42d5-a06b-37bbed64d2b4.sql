-- Add is_manual tracking columns first
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_reason TEXT;

-- Find and cancel duplicate sessions, keeping the most recent created_at
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY class_id, date, start_time 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM public.sessions
  WHERE status <> 'Canceled'
)
UPDATE public.sessions s
SET 
  status = 'Canceled',
  canceled_reason = 'Duplicate session removed during index creation',
  canceled_at = now(),
  is_manual = true
FROM duplicates d
WHERE s.id = d.id 
  AND d.rn > 1
  AND s.status <> 'Canceled';

-- Now create the partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS sessions_class_date_time_unique 
ON public.sessions (class_id, date, start_time) 
WHERE status <> 'Canceled';

COMMENT ON INDEX sessions_class_date_time_unique IS 'Prevents duplicate active sessions for same class, date, and time. Canceled sessions are excluded to allow recreation.';