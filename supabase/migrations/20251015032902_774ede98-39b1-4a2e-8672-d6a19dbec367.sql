-- Fix critical RLS policy security issues
-- This migration addresses:
-- 1. Teacher PII exposure to unauthenticated users
-- 2. Class schedule exposure to unauthenticated users  
-- 3. Bank account details accessible to all authenticated users

-- Fix 1: Restrict teacher information to authenticated users only
DROP POLICY IF EXISTS "Everyone can view active teachers" ON public.teachers;

CREATE POLICY "Authenticated users can view teachers"
  ON public.teachers FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Fix 2: Restrict class schedules to authenticated users only
DROP POLICY IF EXISTS "Everyone can view scheduled sessions" ON public.sessions;

CREATE POLICY "Authenticated users can view sessions"
  ON public.sessions FOR SELECT
  USING (
    (status IN ('Scheduled', 'Held')) 
    AND auth.uid() IS NOT NULL
  );

-- Fix 3: Restrict bank info to only admins, families, and students (users who need to make payments)
DROP POLICY IF EXISTS "Authenticated users can view bank info" ON public.bank_info;

CREATE POLICY "Admins and families can view bank info"
  ON public.bank_info FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'family')
    OR EXISTS (
      SELECT 1 FROM public.students 
      WHERE linked_user_id = auth.uid()
    )
  );