-- Fix journal_members RLS policy to allow trigger to create owner memberships
DROP POLICY IF EXISTS "Owners can invite members" ON journal_members;

CREATE POLICY "Owners can invite members"
  ON journal_members FOR INSERT
  WITH CHECK (
    -- Allow creating owner memberships (for the trigger)
    role = 'owner' OR
    -- Allow admins
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Allow journal owners to invite others
    is_journal_owner(journal_id, auth.uid())
  );