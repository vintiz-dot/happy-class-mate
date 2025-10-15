-- Fix v_projected_base view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view respects Row Level Security policies

DROP VIEW IF EXISTS public.v_projected_base;

CREATE VIEW public.v_projected_base
WITH (security_invoker = true)
AS
SELECT e.student_id,
    (date_trunc('month'::text, (s.date)::timestamp with time zone))::date AS month_start,
    to_char(date_trunc('month'::text, (s.date)::timestamp with time zone), 'YYYY-MM'::text) AS ym,
    (count(*))::integer AS projected_sessions,
    (COALESCE(sum(c.session_rate_vnd), (0)::bigint))::integer AS projected_base
FROM ((sessions s
    JOIN enrollments e ON ((e.class_id = s.class_id)))
    JOIN classes c ON ((c.id = s.class_id)))
WHERE ((s.status = ANY (ARRAY['Scheduled'::session_status, 'Held'::session_status])) 
    AND (e.start_date <= s.date) 
    AND ((e.end_date IS NULL) OR (s.date <= e.end_date)))
GROUP BY e.student_id, (date_trunc('month'::text, (s.date)::timestamp with time zone));