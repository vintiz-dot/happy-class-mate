-- Fix infinite recursion in journal_members RLS policies

-- Create security definer function to check journal membership
CREATE OR REPLACE FUNCTION is_journal_member(_journal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM journal_members
    WHERE journal_id = _journal_id
      AND user_id = _user_id
      AND status = 'active'
  )
$$;

-- Create security definer function to check if user is journal owner
CREATE OR REPLACE FUNCTION is_journal_owner(_journal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM journals
    WHERE id = _journal_id
      AND owner_user_id = _user_id
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create journals" ON journals;
DROP POLICY IF EXISTS "Users can read their journals" ON journals;
DROP POLICY IF EXISTS "Members can update journals" ON journals;
DROP POLICY IF EXISTS "Owners can delete journals" ON journals;
DROP POLICY IF EXISTS "Owners can invite members" ON journal_members;
DROP POLICY IF EXISTS "Members can view journal membership" ON journal_members;
DROP POLICY IF EXISTS "Members can update their membership" ON journal_members;
DROP POLICY IF EXISTS "Members can leave journals" ON journal_members;
DROP POLICY IF EXISTS "System can create audit logs" ON journal_audit;
DROP POLICY IF EXISTS "Members can read audit logs" ON journal_audit;

-- Recreate journals policies with security definer functions

CREATE POLICY "Users can create journals"
  ON journals FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can read their journals"
  ON journals FOR SELECT
  USING (
    NOT is_deleted AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      is_journal_member(id, auth.uid())
    )
  );

CREATE POLICY "Members can update journals"
  ON journals FOR UPDATE
  USING (
    NOT is_deleted AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      is_journal_member(id, auth.uid())
    )
  );

CREATE POLICY "Owners can delete journals"
  ON journals FOR DELETE
  USING (
    owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Recreate journal_members policies with security definer functions

CREATE POLICY "Owners can invite members"
  ON journal_members FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_owner(journal_id, auth.uid())
  );

CREATE POLICY "Members can view journal membership"
  ON journal_members FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_member(journal_id, auth.uid())
  );

CREATE POLICY "Members can update their membership"
  ON journal_members FOR UPDATE
  USING (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_owner(journal_id, auth.uid())
  );

CREATE POLICY "Members can leave journals"
  ON journal_members FOR DELETE
  USING (
    (user_id = auth.uid() AND role != 'owner') OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_owner(journal_id, auth.uid())
  );

-- Recreate journal_audit policies

CREATE POLICY "System can create audit logs"
  ON journal_audit FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Members can read audit logs"
  ON journal_audit FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_member(journal_id, auth.uid())
  );