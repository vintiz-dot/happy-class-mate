-- Create table for tracking login streaks (daily check-ins)
CREATE TABLE public.student_login_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  last_homework_check DATE,
  streak_freeze_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id)
);

-- Create table for tracking attendance streaks per class
CREATE TABLE public.student_attendance_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  consecutive_days INTEGER DEFAULT 0,
  last_attendance_date DATE,
  bonuses_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, class_id)
);

-- Create table to track daily login rewards (prevent double claiming)
CREATE TABLE public.daily_login_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reward_date DATE NOT NULL,
  xp_awarded INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, reward_date)
);

-- Enable RLS on all tables
ALTER TABLE public.student_login_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_login_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_login_streaks
CREATE POLICY "Admins can manage login streaks"
  ON public.student_login_streaks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own login streak"
  ON public.student_login_streaks FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Students can update own login streak"
  ON public.student_login_streaks FOR UPDATE
  USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Students can insert own login streak"
  ON public.student_login_streaks FOR INSERT
  WITH CHECK (can_view_student(student_id, auth.uid()));

-- RLS policies for student_attendance_streaks
CREATE POLICY "Admins can manage attendance streaks"
  ON public.student_attendance_streaks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own attendance streak"
  ON public.student_attendance_streaks FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Teachers can view class attendance streaks"
  ON public.student_attendance_streaks FOR SELECT
  USING (is_teacher_of_class(auth.uid(), class_id));

-- RLS policies for daily_login_rewards
CREATE POLICY "Admins can manage login rewards"
  ON public.daily_login_rewards FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own login rewards"
  ON public.daily_login_rewards FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Students can insert own login rewards"
  ON public.daily_login_rewards FOR INSERT
  WITH CHECK (can_view_student(student_id, auth.uid()));

-- Add updated_at trigger for login_streaks
CREATE TRIGGER update_student_login_streaks_updated_at
  BEFORE UPDATE ON public.student_login_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for attendance_streaks
CREATE TRIGGER update_student_attendance_streaks_updated_at
  BEFORE UPDATE ON public.student_attendance_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();