-- Remove the policy that allows classmates to view each other's homework submissions
-- (including grades, teacher feedback, and submission files)
-- Students should only see their own submissions
DROP POLICY IF EXISTS "Classmates can view submissions" ON public.homework_submissions;