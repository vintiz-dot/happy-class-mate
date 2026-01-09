-- Create xp_settings table for configurable XP values
CREATE TABLE public.xp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.xp_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read xp_settings (students need to see XP values)
CREATE POLICY "XP settings are publicly readable"
ON public.xp_settings
FOR SELECT
USING (true);

-- Only admins can modify xp_settings
CREATE POLICY "Only admins can modify xp_settings"
ON public.xp_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Create custom_quests table for admin-defined quests
CREATE TABLE public.custom_quests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '⭐',
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_quests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read custom_quests
CREATE POLICY "Custom quests are publicly readable"
ON public.custom_quests
FOR SELECT
USING (true);

-- Only admins can manage custom_quests
CREATE POLICY "Only admins can manage custom_quests"
ON public.custom_quests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Insert default XP settings
INSERT INTO public.xp_settings (setting_key, setting_name, points, description, category) VALUES
  ('daily_checkin', 'Daily Check-In', 1, 'Visit the homework page each day', 'daily'),
  ('early_submission', 'Early Submission Bonus', 5, 'Submit homework before the due date', 'homework'),
  ('homework_max', 'Maximum Homework Points', 100, 'Maximum points for homework completion', 'homework'),
  ('participation_min', 'Minimum Participation Points', 1, 'Minimum points per participation event', 'participation'),
  ('participation_max', 'Maximum Participation Points', 10, 'Maximum points per participation event', 'participation'),
  ('attendance_streak_5', 'Attendance Streak (5 days)', 50, 'Bonus for attending 5 consecutive classes', 'streaks'),
  ('attendance_streak_10', 'Attendance Streak (10 days)', 100, 'Bonus for attending 10 consecutive classes', 'streaks'),
  ('perfect_week', 'Perfect Week', 25, 'Complete all homework and attend all classes in a week', 'achievements');

-- Create trigger for updated_at on xp_settings
CREATE TRIGGER update_xp_settings_updated_at
BEFORE UPDATE ON public.xp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on custom_quests  
CREATE TRIGGER update_custom_quests_updated_at
BEFORE UPDATE ON public.custom_quests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();