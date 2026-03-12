
-- 1. Fix handle_new_user trigger: block admin from users.role too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.app_role,
    'student'::public.app_role
  );

  -- Block admin role from self-service signup in BOTH tables
  IF v_role = 'admin'::public.app_role THEN
    RAISE WARNING 'Blocked attempt to create admin account via signup for user %', NEW.id;
    v_role := 'student'::public.app_role;
  END IF;

  INSERT INTO public.users (id, role) VALUES (NEW.id, v_role);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$function$;

-- 2. Fix xp_settings RLS: use has_role instead of users.role
DROP POLICY IF EXISTS "Only admins can modify xp_settings" ON public.xp_settings;
CREATE POLICY "Only admins can modify xp_settings" ON public.xp_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. Fix custom_quests RLS: use has_role instead of users.role
DROP POLICY IF EXISTS "Only admins can modify custom_quests" ON public.custom_quests;
CREATE POLICY "Only admins can modify custom_quests" ON public.custom_quests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
