-- Fix journal_members RLS to allow trigger to create owner memberships
-- The issue is that SECURITY DEFINER functions need policies that don't rely on auth.uid()

DROP POLICY IF EXISTS "System can create owner memberships" ON journal_members;

CREATE POLICY "System can create owner memberships"
  ON journal_members FOR INSERT
  TO public  -- Changed from 'authenticated' to 'public' to allow trigger execution
  WITH CHECK (role = 'owner');