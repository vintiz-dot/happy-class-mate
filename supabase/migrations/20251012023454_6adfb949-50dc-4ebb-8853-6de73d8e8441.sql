-- Create user_roles table with proper security
-- Drop old role-based policies first
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can manage bank info" ON public.bank_info;
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can manage discount assignments" ON public.discount_assignments;
DROP POLICY IF EXISTS "Admins can manage discount definitions" ON public.discount_definitions;
DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Admins can manage families" ON public.families;
DROP POLICY IF EXISTS "Admins can view all families" ON public.families;
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can manage ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Admins can manage ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payroll summaries" ON public.payroll_summaries;
DROP POLICY IF EXISTS "Admins can manage referral bonuses" ON public.referral_bonuses;
DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Admins can view all students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update handle_new_user trigger to use user_roles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert into users table (keep for backward compatibility)
  INSERT INTO public.users (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.app_role,
      'student'::public.app_role
    )
  );
  
  -- Insert into user_roles table (new secure approach)
  -- BLOCK admin role from self-service signup
  IF COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'::public.app_role) != 'admin'::public.app_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      COALESCE(
        (NEW.raw_user_meta_data->>'role')::public.app_role,
        'student'::public.app_role
      )
    );
  ELSE
    -- Log attempt to create admin via signup
    RAISE WARNING 'Blocked attempt to create admin account via signup for user %', NEW.id;
    -- Default to student role instead
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::public.app_role);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- RLS policy for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Recreate all policies using has_role function
CREATE POLICY "Admins can view audit log" ON public.audit_log
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage bank info" ON public.bank_info
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage classes" ON public.classes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage discount assignments" ON public.discount_assignments
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage discount definitions" ON public.discount_definitions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage enrollments" ON public.enrollments
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage families" ON public.families
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all families" ON public.families
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage invoices" ON public.invoices
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ledger accounts" ON public.ledger_accounts
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ledger entries" ON public.ledger_entries
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payments" ON public.payments
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payroll summaries" ON public.payroll_summaries
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage referral bonuses" ON public.referral_bonuses
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all sessions" ON public.sessions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage students" ON public.students
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all students" ON public.students
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage teachers" ON public.teachers
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);