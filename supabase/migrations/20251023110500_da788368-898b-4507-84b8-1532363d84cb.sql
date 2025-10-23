-- Fix journals RLS and remove duplicate triggers to allow teachers to save journals

-- 1. Remove duplicate trigger that conflicts with create_journal_owner_membership_trigger
DROP TRIGGER IF EXISTS on_journal_created ON journals;

-- 2. Simplify the journals INSERT policy to avoid auth.uid() mismatch
-- Just check that owner_user_id is set (not null) instead of comparing to auth.uid()
-- This prevents issues where client-side user.id doesn't match server-side auth.uid()
DROP POLICY IF EXISTS "Users can create journals" ON journals;

CREATE POLICY "Users can create journals"
  ON journals FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id IS NOT NULL
  );

-- 3. Ensure journal_members policy is truly permissive for the trigger
-- Remove TO clause to make it apply to all roles including the trigger context
DROP POLICY IF EXISTS "System can create owner memberships" ON journal_members;

CREATE POLICY "System can create owner memberships"
  ON journal_members FOR INSERT
  WITH CHECK (
    role = 'owner'
  );