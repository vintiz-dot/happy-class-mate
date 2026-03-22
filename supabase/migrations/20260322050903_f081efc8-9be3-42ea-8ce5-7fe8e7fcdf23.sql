
-- Teaching Assistants table (mirrors teachers structure)
CREATE TABLE public.teaching_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  bio text,
  avatar_url text,
  hourly_rate_vnd integer NOT NULL DEFAULT 150000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Session Participants table (links TAs to sessions)
CREATE TABLE public.session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'teaching_assistant',
  teaching_assistant_id uuid REFERENCES public.teaching_assistants(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT valid_participant CHECK (
    (participant_type = 'teaching_assistant' AND teaching_assistant_id IS NOT NULL) OR
    (participant_type = 'teacher' AND teacher_id IS NOT NULL)
  ),
  UNIQUE(session_id, teaching_assistant_id),
  UNIQUE(session_id, teacher_id)
);

-- Indexes
CREATE INDEX idx_teaching_assistants_active ON public.teaching_assistants(is_active);
CREATE INDEX idx_teaching_assistants_user ON public.teaching_assistants(user_id);
CREATE INDEX idx_session_participants_session ON public.session_participants(session_id);
CREATE INDEX idx_session_participants_ta ON public.session_participants(teaching_assistant_id);

-- Enable RLS
ALTER TABLE public.teaching_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS for teaching_assistants
CREATE POLICY "Admins can manage teaching_assistants" ON public.teaching_assistants
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active TAs" ON public.teaching_assistants
  FOR SELECT TO public USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "TAs can update own record" ON public.teaching_assistants
  FOR UPDATE TO public USING (user_id = auth.uid());

CREATE POLICY "TAs can view own record" ON public.teaching_assistants
  FOR SELECT TO public USING (user_id = auth.uid());

-- RLS for session_participants
CREATE POLICY "Admins can manage session_participants" ON public.session_participants
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view session_participants" ON public.session_participants
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE s.id = session_participants.session_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "TAs can view own session_participants" ON public.session_participants
  FOR SELECT TO public USING (
    teaching_assistant_id IN (
      SELECT id FROM teaching_assistants WHERE user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_teaching_assistants_updated_at
  BEFORE UPDATE ON public.teaching_assistants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
