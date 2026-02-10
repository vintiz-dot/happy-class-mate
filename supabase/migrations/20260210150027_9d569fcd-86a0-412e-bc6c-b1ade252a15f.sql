
-- Create site_announcements table
CREATE TABLE public.site_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text,
  display_type text NOT NULL DEFAULT 'banner' CHECK (display_type IN ('banner', 'popup', 'sticky_header', 'footer_bar', 'splash', 'toast')),
  priority int NOT NULL DEFAULT 0,
  target_audience text NOT NULL DEFAULT 'everyone' CHECK (target_audience IN ('everyone', 'authenticated', 'students', 'teachers', 'families', 'paying_students')),
  placement text NOT NULL DEFAULT 'both' CHECK (placement IN ('before_login', 'after_login', 'both')),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  is_dismissible boolean NOT NULL DEFAULT true,
  style_config jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create announcement_dismissals table
CREATE TABLE public.announcement_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.site_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- RLS for site_announcements: Admins full CRUD
CREATE POLICY "Admins can manage announcements"
ON public.site_announcements FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read active announcements
CREATE POLICY "Authenticated users can view active announcements"
ON public.site_announcements FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
);

-- Anonymous users can see public announcements
CREATE POLICY "Anonymous can view public announcements"
ON public.site_announcements FOR SELECT
USING (
  auth.uid() IS NULL
  AND is_active = true
  AND (placement = 'before_login' OR target_audience = 'everyone')
);

-- RLS for announcement_dismissals
CREATE POLICY "Users can insert own dismissals"
ON public.announcement_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own dismissals"
ON public.announcement_dismissals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all dismissals"
ON public.announcement_dismissals FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_site_announcements_updated_at
BEFORE UPDATE ON public.site_announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for announcement images
INSERT INTO storage.buckets (id, name, public) VALUES ('announcements', 'announcements', true);

-- Storage policies
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements');

CREATE POLICY "Admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcement images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcement images"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_site_announcements_active ON public.site_announcements (is_active, priority DESC) WHERE is_active = true;
CREATE INDEX idx_announcement_dismissals_user ON public.announcement_dismissals (user_id, announcement_id);
