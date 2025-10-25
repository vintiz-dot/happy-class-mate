-- Create homework storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Create notifications table for journal updates
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_id UUID REFERENCES public.journals(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_journal', 'journal_update', 'new_member'
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- System can create notifications
CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- Function to create notifications for journal posts
CREATE OR REPLACE FUNCTION public.notify_journal_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_title TEXT;
BEGIN
  -- Get journal type-specific title
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New student journal: ' || NEW.title INTO v_title;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
    WHEN 'collaborative' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;

  -- Notify all members except the creator
  FOR v_member IN 
    SELECT user_id 
    FROM journal_members 
    WHERE journal_id = NEW.id 
      AND user_id != NEW.owner_user_id
      AND status = 'active'
  LOOP
    INSERT INTO public.notifications (user_id, journal_id, type, title, message, metadata)
    VALUES (
      v_member.user_id,
      NEW.id,
      'new_journal',
      v_title,
      'A new journal entry has been posted',
      jsonb_build_object(
        'journal_type', NEW.type,
        'student_id', NEW.student_id,
        'class_id', NEW.class_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for new journal posts
DROP TRIGGER IF EXISTS trigger_notify_journal_post ON public.journals;
CREATE TRIGGER trigger_notify_journal_post
AFTER INSERT ON public.journals
FOR EACH ROW
WHEN (NEW.is_deleted = false)
EXECUTE FUNCTION public.notify_journal_post();