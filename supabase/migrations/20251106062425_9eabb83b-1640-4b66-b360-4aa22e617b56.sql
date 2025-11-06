
-- Enable realtime for student_points table
ALTER TABLE public.student_points REPLICA IDENTITY FULL;

-- Add to realtime publication (if not already there)
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_points;
