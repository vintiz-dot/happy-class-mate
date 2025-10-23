-- Temporarily disable the trigger to diagnose the issue
DROP TRIGGER IF EXISTS create_journal_owner_membership_trigger ON journals;

-- Ensure RLS is enabled
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_members ENABLE ROW LEVEL SECURITY;

-- Recreate a simpler INSERT policy for journals
DROP POLICY IF EXISTS "Users can create journals" ON journals;

CREATE POLICY "Users can create journals"
  ON journals FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- Recreate trigger with better error handling
CREATE OR REPLACE FUNCTION public.create_journal_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create owner membership
  INSERT INTO public.journal_members (journal_id, user_id, role, status, accepted_at)
  VALUES (NEW.id, NEW.owner_user_id, 'owner', 'active', now());
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create journal member: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER create_journal_owner_membership_trigger
AFTER INSERT ON journals
FOR EACH ROW
EXECUTE FUNCTION create_journal_owner_membership();

-- Ensure journal_members INSERT policy allows owner creation without checks
DROP POLICY IF EXISTS "Owners can invite members" ON journal_members;

-- Separate policies for different scenarios
CREATE POLICY "System can create owner memberships"
  ON journal_members FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'owner'
  );

CREATE POLICY "Admins and owners can invite members"
  ON journal_members FOR INSERT
  TO authenticated
  WITH CHECK (
    role != 'owner' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM journal_members jm
        WHERE jm.journal_id = journal_members.journal_id
        AND jm.user_id = auth.uid()
        AND jm.role = 'owner'
        AND jm.status = 'active'
      )
    )
  );