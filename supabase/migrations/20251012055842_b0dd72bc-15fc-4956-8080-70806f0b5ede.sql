-- Fix infinite recursion in RLS policies by using security definer functions

-- Create function to check if user can view a family
CREATE OR REPLACE FUNCTION public.can_view_family(family_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_id
    AND (
      f.primary_user_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.family_id = f.id
        AND s.linked_user_id = user_id
      )
    )
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Family users can view own family" ON public.families;
DROP POLICY IF EXISTS "Family users can view family students" ON public.students;

-- Recreate family policy using the security definer function
CREATE POLICY "Family users can view own family"
ON public.families
FOR SELECT
TO authenticated
USING (
  can_view_family(id, auth.uid())
);

-- Recreate students policy using the existing can_view_student function
CREATE POLICY "Family users can view family students"
ON public.students
FOR SELECT
TO authenticated
USING (
  can_view_student(id, auth.uid())
);