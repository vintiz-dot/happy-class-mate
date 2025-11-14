-- Safe revert: Remove broken RLS policy and function

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Students can view classmate enrollments for leaderboard" ON public.enrollments;

-- Step 2: Drop the security definer function
DROP FUNCTION IF EXISTS public.get_student_active_class_ids(uuid);