
-- Drop the existing permissive UPDATE policy that allows unrestricted self-updates
DROP POLICY IF EXISTS "Users can update own record" ON public.users;

-- Recreate with a WITH CHECK that prevents role changes
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid()));
