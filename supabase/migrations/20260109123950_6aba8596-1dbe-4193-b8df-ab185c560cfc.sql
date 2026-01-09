-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Students can view classmates enrollments" ON public.enrollments;