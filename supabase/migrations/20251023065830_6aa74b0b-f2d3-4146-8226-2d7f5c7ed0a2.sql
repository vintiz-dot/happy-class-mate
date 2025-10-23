-- Create journal tables with proper structure and RLS

-- Create journal type enum
DO $$ BEGIN
  CREATE TYPE journal_type AS ENUM ('personal', 'student', 'class', 'collab_student_teacher');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create journal member role enum
DO $$ BEGIN
  CREATE TYPE journal_member_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create journal member status enum
DO $$ BEGIN
  CREATE TYPE journal_member_status AS ENUM ('active', 'invited');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create journal action enum
DO $$ BEGIN
  CREATE TYPE journal_action AS ENUM ('create', 'invite', 'accept', 'update', 'leave', 'delete');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create journals table
CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type journal_type NOT NULL,
  title TEXT NOT NULL,
  content_rich TEXT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_type_check CHECK (
    (type = 'personal' AND student_id IS NULL AND class_id IS NULL) OR
    (type = 'student' AND student_id IS NOT NULL AND class_id IS NULL) OR
    (type = 'class' AND class_id IS NOT NULL AND student_id IS NULL) OR
    (type = 'collab_student_teacher' AND student_id IS NULL AND class_id IS NULL)
  )
);

-- Create journal_members table
CREATE TABLE IF NOT EXISTS journal_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role journal_member_role NOT NULL DEFAULT 'viewer',
  status journal_member_status NOT NULL DEFAULT 'active',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(journal_id, user_id)
);

-- Create journal_audit table
CREATE TABLE IF NOT EXISTS journal_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action journal_action NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trigger to auto-create owner membership
CREATE OR REPLACE FUNCTION create_journal_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO journal_members (journal_id, user_id, role, status, accepted_at)
  VALUES (NEW.id, NEW.owner_user_id, 'owner', 'active', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_journal_created ON journals;
CREATE TRIGGER on_journal_created
  AFTER INSERT ON journals
  FOR EACH ROW
  EXECUTE FUNCTION create_journal_owner_membership();

-- Create audit trigger
CREATE OR REPLACE FUNCTION audit_journal_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO journal_audit (journal_id, actor_user_id, action, after)
    VALUES (NEW.id, NEW.owner_user_id, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO journal_audit (journal_id, actor_user_id, action, before, after)
    VALUES (NEW.id, auth.uid(), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO journal_audit (journal_id, actor_user_id, action, before)
    VALUES (OLD.id, auth.uid(), 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_journal_trigger ON journals;
CREATE TRIGGER audit_journal_trigger
  AFTER INSERT OR UPDATE OR DELETE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION audit_journal_changes();

-- Enable RLS
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journals

-- CREATE: Any authenticated user can create journals
CREATE POLICY "Users can create journals"
  ON journals FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- READ: Users can read journals they have membership to OR admins
CREATE POLICY "Users can read their journals"
  ON journals FOR SELECT
  USING (
    NOT is_deleted AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM journal_members
        WHERE journal_members.journal_id = journals.id
        AND journal_members.user_id = auth.uid()
        AND journal_members.status = 'active'
      )
    )
  );

-- UPDATE: Owner or editors can update
CREATE POLICY "Members can update journals"
  ON journals FOR UPDATE
  USING (
    NOT is_deleted AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM journal_members
        WHERE journal_members.journal_id = journals.id
        AND journal_members.user_id = auth.uid()
        AND journal_members.role IN ('owner', 'editor')
        AND journal_members.status = 'active'
      )
    )
  );

-- DELETE: Only owner can soft delete (set is_deleted = true)
CREATE POLICY "Owners can delete journals"
  ON journals FOR UPDATE
  USING (
    owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS Policies for journal_members

-- CREATE: Owners can invite members
CREATE POLICY "Owners can invite members"
  ON journal_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journals
      WHERE journals.id = journal_members.journal_id
      AND (journals.owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- READ: Members can see other members of their journals
CREATE POLICY "Members can view journal membership"
  ON journal_members FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM journal_members jm2
      WHERE jm2.journal_id = journal_members.journal_id
      AND jm2.user_id = auth.uid()
      AND jm2.status = 'active'
    )
  );

-- UPDATE: Invitees can accept invites, owners can change roles
CREATE POLICY "Members can update their membership"
  ON journal_members FOR UPDATE
  USING (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM journals
      WHERE journals.id = journal_members.journal_id
      AND journals.owner_user_id = auth.uid()
    )
  );

-- DELETE: Non-owners can leave, owners can remove others
CREATE POLICY "Members can leave journals"
  ON journal_members FOR DELETE
  USING (
    (user_id = auth.uid() AND role != 'owner') OR
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM journals
      WHERE journals.id = journal_members.journal_id
      AND journals.owner_user_id = auth.uid()
    )
  );

-- RLS Policies for journal_audit

-- CREATE: Handled by triggers
CREATE POLICY "System can create audit logs"
  ON journal_audit FOR INSERT
  WITH CHECK (true);

-- READ: Members of the journal can read audit logs
CREATE POLICY "Members can read audit logs"
  ON journal_audit FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM journal_members
      WHERE journal_members.journal_id = journal_audit.journal_id
      AND journal_members.user_id = auth.uid()
      AND journal_members.status = 'active'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_journals_owner ON journals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_journals_student ON journals(student_id);
CREATE INDEX IF NOT EXISTS idx_journals_class ON journals(class_id);
CREATE INDEX IF NOT EXISTS idx_journals_type ON journals(type);
CREATE INDEX IF NOT EXISTS idx_journals_deleted ON journals(is_deleted);
CREATE INDEX IF NOT EXISTS idx_journal_members_journal ON journal_members(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_members_user ON journal_members(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_members_status ON journal_members(status);
CREATE INDEX IF NOT EXISTS idx_journal_audit_journal ON journal_audit(journal_id);