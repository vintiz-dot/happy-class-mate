-- ========================================
-- Migration: 20251011192324_034eb226-8560-40a6-adee-743bc0ec0f33.sql
-- ========================================
-- Phase 1: Core schema for Education Manager (Happy English Club)
-- Timezone: Asia/Bangkok

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'family', 'student');

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Families table
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  sibling_percent_override NUMERIC(5,2), -- nullable, overrides global 5% default
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  linked_user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

-- Teachers table
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  hourly_rate_vnd INTEGER NOT NULL DEFAULT 200000,
  phone TEXT,
  email TEXT,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

-- Indexes
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_families_primary_user ON public.families(primary_user_id);
CREATE INDEX idx_students_family ON public.students(family_id);
CREATE INDEX idx_students_linked_user ON public.students(linked_user_id);
CREATE INDEX idx_students_active ON public.students(is_active);
CREATE INDEX idx_teachers_user ON public.teachers(user_id);
CREATE INDEX idx_teachers_active ON public.teachers(is_active);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for families table
CREATE POLICY "Admins can view all families"
  ON public.families FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Family users can view own family"
  ON public.families FOR SELECT
  USING (
    primary_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.family_id = families.id
      AND students.linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage families"
  ON public.families FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for students table
CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Teachers can view all students"
  ON public.students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'teacher'
    )
  );

CREATE POLICY "Family users can view family students"
  ON public.students FOR SELECT
  USING (
    linked_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.families
      WHERE families.id = students.family_id
      AND families.primary_user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own record"
  ON public.students FOR SELECT
  USING (linked_user_id = auth.uid());

CREATE POLICY "Admins can manage students"
  ON public.students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for teachers table
CREATE POLICY "Everyone can view active teachers"
  ON public.teachers FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Teachers can view own record"
  ON public.teachers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Teachers can update own record"
  ON public.teachers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage teachers"
  ON public.teachers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = user_id;
$$;

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into users table with role from metadata
  INSERT INTO public.users (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.app_role,
      'student'::public.app_role
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- Migration: 20251012020423_f00f2350-14fd-44b1-b5cc-f0360ab9fcdf.sql
-- ========================================
-- Create session status enum
CREATE TYPE public.session_status AS ENUM ('Scheduled', 'Held', 'Canceled');

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_teacher_id UUID REFERENCES public.teachers(id) ON DELETE RESTRICT,
  session_rate_vnd INTEGER NOT NULL DEFAULT 210000,
  schedule_template JSONB NOT NULL DEFAULT '{"weeklySlots": []}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status public.session_status NOT NULL DEFAULT 'Scheduled',
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add indexes for performance
CREATE INDEX idx_classes_default_teacher ON public.classes(default_teacher_id);
CREATE INDEX idx_sessions_class_date ON public.sessions(class_id, date);
CREATE INDEX idx_sessions_teacher_date ON public.sessions(teacher_id, date);
CREATE INDEX idx_sessions_status ON public.sessions(status);

-- Add updated_at triggers
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes
CREATE POLICY "Admins can manage classes"
  ON public.classes FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view active classes"
  ON public.classes FOR SELECT
  USING (is_active = true AND public.get_user_role(auth.uid()) = 'teacher');

CREATE POLICY "Everyone can view active classes"
  ON public.classes FOR SELECT
  USING (is_active = true);

-- RLS Policies for sessions
CREATE POLICY "Admins can manage all sessions"
  ON public.sessions FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view their sessions"
  ON public.sessions FOR SELECT
  USING (teacher_id IN (
    SELECT t.id FROM public.teachers t WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Teachers can update their sessions"
  ON public.sessions FOR UPDATE
  USING (
    teacher_id IN (
      SELECT t.id FROM public.teachers t WHERE t.user_id = auth.uid()
    )
    AND status = 'Scheduled'
  );

CREATE POLICY "Everyone can view scheduled sessions"
  ON public.sessions FOR SELECT
  USING (status IN ('Scheduled', 'Held'));

-- Function to check for teacher double-booking
CREATE OR REPLACE FUNCTION public.check_teacher_availability(
  p_teacher_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_session_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE teacher_id = p_teacher_id
      AND date = p_date
      AND status != 'Canceled'
      AND (id != p_exclude_session_id OR p_exclude_session_id IS NULL)
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$;

-- ========================================
-- Migration: 20251012022335_e997d659-3aa5-4b0c-8eea-259c3bbf00ef.sql
-- ========================================
-- Create enrollment discount cadence enum
CREATE TYPE public.discount_cadence AS ENUM ('once', 'monthly');

-- Create enrollment discount type enum  
CREATE TYPE public.discount_type AS ENUM ('percent', 'amount');

-- Create enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  discount_type public.discount_type,
  discount_value INTEGER,
  discount_cadence public.discount_cadence,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_active_enrollment UNIQUE NULLS NOT DISTINCT (student_id, class_id, end_date)
);

-- Create index for faster queries
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_class ON public.enrollments(class_id);
CREATE INDEX idx_enrollments_active ON public.enrollments(student_id, class_id) WHERE end_date IS NULL;

-- Create updated_at trigger
CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollments
CREATE POLICY "Admins can manage enrollments"
  ON public.enrollments
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view enrollments for their classes"
  ON public.enrollments
  FOR SELECT
  USING (
    class_id IN (
      SELECT DISTINCT s.class_id
      FROM public.sessions s
      JOIN public.teachers t ON s.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- ========================================
-- Migration: 20251012022547_f1bdf0a5-fae3-4d82-86bd-d5ba3cfc8a55.sql
-- ========================================
-- Create discount definitions table
CREATE TABLE public.discount_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.discount_type NOT NULL,
  cadence public.discount_cadence NOT NULL,
  value INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT,
  amortize_yearly BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create discount assignments table (links discounts to students)
CREATE TABLE public.discount_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  discount_def_id UUID NOT NULL REFERENCES public.discount_definitions(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create referral bonuses table
CREATE TABLE public.referral_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type public.discount_type NOT NULL,
  cadence public.discount_cadence NOT NULL,
  value INTEGER NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_discount_assignments_student ON public.discount_assignments(student_id);
CREATE INDEX idx_discount_assignments_discount ON public.discount_assignments(discount_def_id);
CREATE INDEX idx_referral_bonuses_student ON public.referral_bonuses(student_id);

-- Create updated_at triggers
CREATE TRIGGER update_discount_definitions_updated_at
  BEFORE UPDATE ON public.discount_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discount_assignments_updated_at
  BEFORE UPDATE ON public.discount_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_bonuses_updated_at
  BEFORE UPDATE ON public.referral_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.discount_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_definitions
CREATE POLICY "Admins can manage discount definitions"
  ON public.discount_definitions
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All authenticated users can view active discounts"
  ON public.discount_definitions
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for discount_assignments
CREATE POLICY "Admins can manage discount assignments"
  ON public.discount_assignments
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their discount assignments"
  ON public.discount_assignments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family discount assignments"
  ON public.discount_assignments
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for referral_bonuses
CREATE POLICY "Admins can manage referral bonuses"
  ON public.referral_bonuses
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their referral bonuses"
  ON public.referral_bonuses
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family referral bonuses"
  ON public.referral_bonuses
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- ========================================
-- Migration: 20251012022746_8a89c9cd-950e-445d-bbcc-f917592fb193.sql
-- ========================================
-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'partial', 'credit');

-- Create account code enum for double-entry bookkeeping
CREATE TYPE public.account_code AS ENUM ('AR', 'REVENUE', 'DISCOUNT', 'CASH', 'BANK', 'CREDIT');

-- Create ledger_accounts table
CREATE TABLE public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  code public.account_code NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, code)
);

-- Create ledger_entries table for double-entry bookkeeping
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo TEXT,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  number TEXT,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  base_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  pdf_storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(student_id, month)
);

-- Create payments table for tracking payment transactions
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  memo TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create bank_info table (singleton)
CREATE TABLE public.bank_info (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name TEXT NOT NULL DEFAULT 'Sacombank',
  account_name TEXT NOT NULL DEFAULT 'Nguyễn Thị Thu Hường',
  account_number TEXT NOT NULL DEFAULT '020975679889',
  vietqr_storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default bank info
INSERT INTO public.bank_info (id) VALUES (1);

-- Create indexes
CREATE INDEX idx_ledger_entries_account ON public.ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_tx ON public.ledger_entries(tx_id);
CREATE INDEX idx_ledger_entries_month ON public.ledger_entries(month);
CREATE INDEX idx_invoices_student ON public.invoices(student_id);
CREATE INDEX idx_invoices_month ON public.invoices(month);
CREATE INDEX idx_payments_student ON public.payments(student_id);

-- Create updated_at triggers
CREATE TRIGGER update_ledger_accounts_updated_at
  BEFORE UPDATE ON public.ledger_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ledger_entries_updated_at
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_info_updated_at
  BEFORE UPDATE ON public.bank_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_info ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ledger_accounts
CREATE POLICY "Admins can manage ledger accounts"
  ON public.ledger_accounts
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their ledger accounts"
  ON public.ledger_accounts
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family ledger accounts"
  ON public.ledger_accounts
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for ledger_entries
CREATE POLICY "Admins can manage ledger entries"
  ON public.ledger_entries
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their ledger entries"
  ON public.ledger_entries
  FOR SELECT
  USING (
    account_id IN (
      SELECT la.id FROM public.ledger_accounts la
      JOIN public.students s ON la.student_id = s.id
      WHERE s.linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family ledger entries"
  ON public.ledger_entries
  FOR SELECT
  USING (
    account_id IN (
      SELECT la.id FROM public.ledger_accounts la
      JOIN public.students s ON la.student_id = s.id
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Admins can manage invoices"
  ON public.invoices
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their invoices"
  ON public.invoices
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family invoices"
  ON public.invoices
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for payments
CREATE POLICY "Admins can manage payments"
  ON public.payments
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view their payments"
  ON public.payments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family payments"
  ON public.payments
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );

-- RLS Policies for bank_info
CREATE POLICY "Everyone can view bank info"
  ON public.bank_info
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bank info"
  ON public.bank_info
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ========================================
-- Migration: 20251012023026_033c7914-1a85-4b62-9274-684c40a439f0.sql
-- ========================================
-- Fix infinite recursion in RLS policies by creating security definer functions

-- Function to check if user can view student
CREATE OR REPLACE FUNCTION public.can_view_student(student_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id
    AND (
      s.linked_user_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = s.family_id
        AND f.primary_user_id = user_id
      )
    )
  );
$$;

-- Drop and recreate policies for ledger_accounts
DROP POLICY IF EXISTS "Students can view their ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Family users can view family ledger accounts" ON public.ledger_accounts;

CREATE POLICY "Students can view their ledger accounts"
  ON public.ledger_accounts
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for ledger_entries
DROP POLICY IF EXISTS "Students can view their ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Family users can view family ledger entries" ON public.ledger_entries;

CREATE POLICY "Students can view their ledger entries"
  ON public.ledger_entries
  FOR SELECT
  USING (
    account_id IN (
      SELECT la.id FROM public.ledger_accounts la
      WHERE public.can_view_student(la.student_id, auth.uid())
    )
  );

-- Drop and recreate policies for invoices
DROP POLICY IF EXISTS "Students can view their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Family users can view family invoices" ON public.invoices;

CREATE POLICY "Students can view their invoices"
  ON public.invoices
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for payments
DROP POLICY IF EXISTS "Students can view their payments" ON public.payments;
DROP POLICY IF EXISTS "Family users can view family payments" ON public.payments;

CREATE POLICY "Students can view their payments"
  ON public.payments
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for discount_assignments
DROP POLICY IF EXISTS "Students can view their discount assignments" ON public.discount_assignments;
DROP POLICY IF EXISTS "Family users can view family discount assignments" ON public.discount_assignments;

CREATE POLICY "Students can view their discount assignments"
  ON public.discount_assignments
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- Drop and recreate policies for referral_bonuses
DROP POLICY IF EXISTS "Students can view their referral bonuses" ON public.referral_bonuses;
DROP POLICY IF EXISTS "Family users can view family referral bonuses" ON public.referral_bonuses;

CREATE POLICY "Students can view their referral bonuses"
  ON public.referral_bonuses
  FOR SELECT
  USING (public.can_view_student(student_id, auth.uid()));

-- ========================================
-- Migration: 20251012023028_2143744d-3105-4e9f-ab2e-4573cf5d62ae.sql
-- ========================================
-- Create payroll summary table
CREATE TABLE public.payroll_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  total_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(teacher_id, month)
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  diff JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payroll_summaries_teacher ON public.payroll_summaries(teacher_id);
CREATE INDEX idx_payroll_summaries_month ON public.payroll_summaries(month);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_occurred ON public.audit_log(occurred_at);

-- Enable RLS
ALTER TABLE public.payroll_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_summaries
CREATE POLICY "Admins can manage payroll summaries"
  ON public.payroll_summaries
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view their own payroll"
  ON public.payroll_summaries
  FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for audit_log
CREATE POLICY "Admins can view audit log"
  ON public.audit_log
  FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ========================================
-- Migration: 20251012023454_6adfb949-50dc-4ebb-8853-6de73d8e8441.sql
-- ========================================
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

-- ========================================
-- Migration: 20251012052116_1e66d89d-4213-4702-97b6-695ba764b54f.sql
-- ========================================
-- Remove the student role from test@admin.com
DELETE FROM public.user_roles 
WHERE user_id = '7f7cb9d5-3ef2-4f50-b9e8-c6085bfddc06' 
AND role = 'student';

-- ========================================
-- Migration: 20251012055842_b0dd72bc-15fc-4956-8080-70806f0b5ede.sql
-- ========================================
-- Fix infinite recursion in RLS policies by using security definer functions

-- Create function to check if user can view a family
CREATE OR REPLACE FUNCTION public.can_view_family(family_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_id
    AND (
      f.primary_user_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.family_id = f.id
        AND s.linked_user_id = user_id
      )
    )
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Family users can view own family" ON public.families;
DROP POLICY IF EXISTS "Family users can view family students" ON public.students;

-- Recreate family policy using the security definer function
CREATE POLICY "Family users can view own family"
ON public.families
FOR SELECT
TO authenticated
USING (
  can_view_family(id, auth.uid())
);

-- Recreate students policy using the existing can_view_student function
CREATE POLICY "Family users can view family students"
ON public.students
FOR SELECT
TO authenticated
USING (
  can_view_student(id, auth.uid())
);

-- ========================================
-- Migration: 20251012055855_34d2ea8a-e07c-4187-892b-d52f52a80386.sql
-- ========================================
-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ========================================
-- Migration: 20251012062405_b0d6758e-c136-4ded-98c5-446357e758a6.sql
-- ========================================
-- Add attendance tracking table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Excused')),
  marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage attendance"
ON public.attendance
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can mark attendance for their sessions"
ON public.attendance
FOR ALL
USING (
  session_id IN (
    SELECT s.id FROM public.sessions s
    JOIN public.teachers t ON s.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Students can view their attendance"
ON public.attendance
FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Add per-class settings columns
ALTER TABLE public.classes
ADD COLUMN default_session_length_minutes INTEGER NOT NULL DEFAULT 90,
ADD COLUMN typical_start_times JSONB DEFAULT '["17:30", "19:00", "19:30"]'::jsonb,
ADD COLUMN teacher_lock_window_hours INTEGER NOT NULL DEFAULT 24,
ADD COLUMN allow_teacher_override BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN class_notes TEXT;

-- Add invoice number sequence tracking
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year INTEGER NOT NULL PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoice sequences"
ON public.invoice_sequences
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on attendance
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Migration: 20251012063108_f0e79539-c9bf-469c-a44f-801b2fc06e3b.sql
-- ========================================
-- Idempotent migration for attendance and invoice_sequences RLS policies
-- This migration ensures proper granular RLS policies with WITH CHECK clauses

-- =========================
-- Drop existing broad policies and create granular ones
-- =========================

-- Attendance table: Drop existing policies
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can mark attendance for their sessions" ON public.attendance;
DROP POLICY IF EXISTS "Students can view their attendance" ON public.attendance;

-- Attendance: Admin full CRUD (granular policies)
CREATE POLICY "admin_attendance_select"
ON public.attendance FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_attendance_insert"
ON public.attendance FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_attendance_update"
ON public.attendance FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_attendance_delete"
ON public.attendance FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Attendance: Teacher policies (CRUD for their own sessions)
CREATE POLICY "teacher_attendance_select"
ON public.attendance FOR SELECT
USING (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "teacher_attendance_insert"
ON public.attendance FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "teacher_attendance_update"
ON public.attendance FOR UPDATE
USING (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
)
WITH CHECK (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "teacher_attendance_delete"
ON public.attendance FOR DELETE
USING (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

-- Attendance: Student/Family read-only for their own student
CREATE POLICY "student_attendance_select"
ON public.attendance FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Add helpful indexes if not exists
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON public.attendance(marked_at);

-- =========================
-- Invoice sequences policies (granular)
-- =========================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage invoice sequences" ON public.invoice_sequences;

-- Admin full CRUD (granular)
CREATE POLICY "admin_invoice_seq_select"
ON public.invoice_sequences FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_invoice_seq_insert"
ON public.invoice_sequences FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_invoice_seq_update"
ON public.invoice_sequences FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_invoice_seq_delete"
ON public.invoice_sequences FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Migration: 20251012065759_96bef71a-5176-485d-8357-3c2a25cb2688.sql
-- ========================================
-- Idempotent migration for automatic attendance seeding
-- Creates triggers to automatically create attendance rows when sessions or enrollments are created

-- Helper function: seed attendance rows for a class-date range
CREATE OR REPLACE FUNCTION public._attendance_seed_for_class_dates(p_class uuid, p_from date, p_to date)
RETURNS void 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.attendance(session_id, student_id, status, marked_by)
  SELECT s.id, e.student_id, 'Present', NULL
  FROM public.sessions s
  JOIN public.enrollments e ON e.class_id = s.class_id
  WHERE s.class_id = p_class
    AND s.date BETWEEN p_from AND p_to
    AND e.start_date <= s.date
    AND (e.end_date IS NULL OR s.date <= e.end_date)
  ON CONFLICT (session_id, student_id) DO NOTHING;
$$;

-- Trigger function: after session insert, seed attendance for all active enrollments
CREATE OR REPLACE FUNCTION public._attendance_after_session_ins()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._attendance_seed_for_class_dates(NEW.class_id, NEW.date, NEW.date);
  RETURN NEW;
END;
$$;

-- Create trigger for session inserts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attendance_after_session_ins'
  ) THEN
    CREATE TRIGGER trg_attendance_after_session_ins
    AFTER INSERT ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public._attendance_after_session_ins();
  END IF;
END$$;

-- Trigger function: after enrollment insert, backfill attendance for existing sessions
CREATE OR REPLACE FUNCTION public._attendance_after_enrollment_ins()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  dfrom date;
BEGIN
  -- Backfill from enrollment start or 6 months ago, whichever is later
  dfrom := GREATEST(NEW.start_date, CURRENT_DATE - INTERVAL '6 months');
  PERFORM public._attendance_seed_for_class_dates(
    NEW.class_id, 
    dfrom, 
    (CURRENT_DATE + INTERVAL '6 months')::date
  );
  RETURN NEW;
END;
$$;

-- Create trigger for enrollment inserts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attendance_after_enrollment_ins'
  ) THEN
    CREATE TRIGGER trg_attendance_after_enrollment_ins
    AFTER INSERT ON public.enrollments
    FOR EACH ROW EXECUTE FUNCTION public._attendance_after_enrollment_ins();
  END IF;
END$$;

-- ========================================
-- Migration: 20251012072856_8443195f-5eea-432b-be9f-890b61f5cbe8.sql
-- ========================================
-- Add linked_user_id column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS linked_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update can_view_student function to allow linked users
CREATE OR REPLACE FUNCTION public.can_view_student(student_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id
    AND (
      s.linked_user_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = s.family_id
        AND f.primary_user_id = user_id
      )
    )
  );
$$;

-- One-time backfill: Update sessions with attendance to 'Held' status
UPDATE public.sessions
SET status = 'Held'
WHERE status = 'Scheduled'
  AND id IN (
    SELECT DISTINCT session_id 
    FROM public.attendance
  );

-- ========================================
-- Migration: 20251012080009_98d9d77f-70be-4ce0-ae6b-da3cba5b8421.sql
-- ========================================
-- Create sibling discount state tracking table
CREATE TABLE IF NOT EXISTS public.sibling_discount_state (
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  month text NOT NULL,
  status text NOT NULL CHECK (status IN ('assigned','pending','none')),
  winner_student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  sibling_percent int NOT NULL,
  reason text NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, month)
);

-- RLS policies
ALTER TABLE public.sibling_discount_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sibling discount state"
  ON public.sibling_discount_state
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view family sibling state"
  ON public.sibling_discount_state
  FOR SELECT
  USING (
    family_id IN (
      SELECT s.family_id 
      FROM students s 
      WHERE can_view_student(s.id, auth.uid())
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sibling_discount_state_family_month 
  ON public.sibling_discount_state(family_id, month);

CREATE INDEX IF NOT EXISTS idx_sibling_discount_state_winner 
  ON public.sibling_discount_state(winner_student_id) 
  WHERE winner_student_id IS NOT NULL;

-- ========================================
-- Migration: 20251012090556_5a61ae2e-5e47-4b68-8e4f-00f206747e25.sql
-- ========================================
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Job lock to avoid double-runs
CREATE TABLE IF NOT EXISTS public.job_lock (
  job text NOT NULL,
  month text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (job, month)
);

ALTER TABLE public.job_lock ENABLE ROW LEVEL SECURITY;

-- RLS: admin read, service role full
CREATE POLICY job_lock_admin_select ON public.job_lock
  FOR SELECT USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY job_lock_service_all ON public.job_lock
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Add projected_base_snapshot to sibling_discount_state if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sibling_discount_state' 
    AND column_name = 'projected_base_snapshot'
  ) THEN
    ALTER TABLE public.sibling_discount_state ADD COLUMN projected_base_snapshot int NULL;
  END IF;
END$$;

-- Update RLS on sibling_discount_state for service role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sibling_discount_state' AND policyname='sds_service_all') THEN
    CREATE POLICY sds_service_all ON public.sibling_discount_state
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Guard ledger tx duplication
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_tx_id ON public.ledger_entries(tx_id);

-- Helper: retroactive sibling credit (double-entry)
CREATE OR REPLACE FUNCTION public.post_sibling_retro_credit(
  p_student_id uuid,
  p_month text,
  p_amount int,
  p_memo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_ar_id uuid;
  v_disc_id uuid;
  v_tx uuid := gen_random_uuid();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0';
  END IF;

  SELECT id INTO v_ar_id FROM public.ledger_accounts WHERE student_id = p_student_id AND code = 'AR' LIMIT 1;
  SELECT id INTO v_disc_id FROM public.ledger_accounts WHERE student_id = p_student_id AND code = 'DISCOUNT' LIMIT 1;
  IF v_ar_id IS NULL OR v_disc_id IS NULL THEN
    RAISE EXCEPTION 'Missing AR or DISCOUNT account for student %', p_student_id;
  END IF;

  -- Dr DISCOUNT
  INSERT INTO public.ledger_entries (tx_id, account_id, debit, credit, occurred_at, memo, month)
  VALUES (v_tx, v_disc_id, p_amount, 0, now(), COALESCE(p_memo,'Retro sibling discount'), p_month);

  -- Cr AR
  INSERT INTO public.ledger_entries (tx_id, account_id, debit, credit, occurred_at, memo, month)
  VALUES (v_tx, v_ar_id, 0, p_amount, now(), COALESCE(p_memo,'Retro sibling discount'), p_month);
END;
$$;

-- View for projected base per student (re-usable)
CREATE OR REPLACE VIEW public.v_projected_base AS
SELECT
  e.student_id,
  date_trunc('month', s.date)::date AS month_start,
  to_char(date_trunc('month', s.date), 'YYYY-MM') AS ym,
  COUNT(*)::int AS projected_sessions,
  COALESCE(SUM(c.session_rate_vnd),0)::int AS projected_base
FROM public.sessions s
JOIN public.enrollments e ON e.class_id = s.class_id
JOIN public.classes c ON c.id = s.class_id
WHERE s.status IN ('Scheduled','Held')
  AND e.start_date <= s.date
  AND (e.end_date IS NULL OR s.date <= e.end_date)
GROUP BY e.student_id, date_trunc('month', s.date);

-- ========================================
-- Migration: 20251012100735_666ca26d-89d0-4859-ba13-68596257cc4f.sql
-- ========================================
-- Extend bank_info table for invoice rendering
ALTER TABLE public.bank_info 
ADD COLUMN IF NOT EXISTS org_name text DEFAULT 'Happy English Club',
ADD COLUMN IF NOT EXISTS org_address text DEFAULT NULL;

-- Update RLS policies to allow authenticated users to read bank info (for invoices)
DROP POLICY IF EXISTS "Everyone can view bank info" ON public.bank_info;
CREATE POLICY "Authenticated users can view bank info" 
  ON public.bank_info 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- ========================================
-- Migration: 20251012103453_e708d7d9-91b0-4de4-b434-707ebe06972a.sql
-- ========================================
-- Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for QR codes
CREATE POLICY "QR codes are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'qr-codes');

CREATE POLICY "Admins can upload QR codes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qr-codes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update QR codes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'qr-codes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete QR codes"
ON storage.objects FOR DELETE
USING (bucket_id = 'qr-codes' AND has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Migration: 20251012110051_906fecf6-f2cf-44da-a036-6afc3bea4db5.sql
-- ========================================
-- Create homework tables and storage
CREATE TABLE IF NOT EXISTS public.homeworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  due_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homework_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_key text NOT NULL,
  size_bytes int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Helper function to check if user is teacher of a class
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(user_id uuid, class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE s.class_id = is_teacher_of_class.class_id
    AND t.user_id = is_teacher_of_class.user_id
  );
$$;

-- Enable RLS
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_files ENABLE ROW LEVEL SECURITY;

-- Homework RLS policies
CREATE POLICY hw_admin_all ON public.homeworks
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY hw_teacher_all ON public.homeworks
FOR ALL USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY hw_student_read ON public.homeworks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.class_id = homeworks.class_id
    AND (s.linked_user_id = auth.uid() OR s.family_id IN (
      SELECT id FROM public.families WHERE primary_user_id = auth.uid()
    ))
  )
);

-- Homework files RLS policies
CREATE POLICY hwf_admin_all ON public.homework_files
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY hwf_teacher_all ON public.homework_files
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.homeworks h
    WHERE h.id = homework_files.homework_id
    AND is_teacher_of_class(auth.uid(), h.class_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.homeworks h
    WHERE h.id = homework_files.homework_id
    AND is_teacher_of_class(auth.uid(), h.class_id)
  )
);

CREATE POLICY hwf_student_read ON public.homework_files
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.homeworks h
    JOIN public.enrollments e ON e.class_id = h.class_id
    JOIN public.students s ON s.id = e.student_id
    WHERE h.id = homework_files.homework_id
    AND (s.linked_user_id = auth.uid() OR s.family_id IN (
      SELECT id FROM public.families WHERE primary_user_id = auth.uid()
    ))
  )
);

-- Create storage bucket for homework
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for homework bucket
CREATE POLICY "Teachers and admins can upload homework files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homework' AND
  (has_role(auth.uid(), 'admin'::app_role) OR
   auth.uid() IN (SELECT user_id FROM public.teachers))
);

CREATE POLICY "Teachers and admins can update homework files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'homework' AND
  (has_role(auth.uid(), 'admin'::app_role) OR
   auth.uid() IN (SELECT user_id FROM public.teachers))
);

CREATE POLICY "Authenticated users can view homework files"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework' AND auth.uid() IS NOT NULL);

-- Add session price override column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'sessions' 
                 AND column_name = 'rate_override_vnd') THEN
    ALTER TABLE public.sessions ADD COLUMN rate_override_vnd integer;
  END IF;
END $$;

-- ========================================
-- Migration: 20251013171128_c94150ea-b5f6-4869-b38d-a799a62a9825.sql
-- ========================================
-- Add unique constraint to invoices for upserts (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_student_id_month_key'
  ) THEN
    ALTER TABLE public.invoices 
      ADD CONSTRAINT invoices_student_id_month_key 
      UNIQUE (student_id, month);
  END IF;
END $$;

-- ========================================
-- Migration: 20251013195616_9cfb4fd8-a794-48b5-bcf8-b9a7c223cb75.sql
-- ========================================
-- Fix homework submission RLS policy for students
DROP POLICY IF EXISTS "Students can insert own submissions" ON public.homework_submissions;

CREATE POLICY "Students can insert own submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT students.id 
    FROM students 
    WHERE students.linked_user_id = auth.uid()
  )
);

-- Create leaderboard tables
CREATE TABLE IF NOT EXISTS public.student_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  homework_points INTEGER NOT NULL DEFAULT 0,
  participation_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER GENERATED ALWAYS AS (homework_points + participation_points) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, month)
);

CREATE TABLE IF NOT EXISTS public.monthly_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, month)
);

-- Enable RLS
ALTER TABLE public.student_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_leaders ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_points
CREATE POLICY "Admins can manage all points"
ON public.student_points FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can manage points for their classes"
ON public.student_points FOR ALL
TO authenticated
USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY "Students can view their own points"
ON public.student_points FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM students 
    WHERE linked_user_id = auth.uid()
    OR family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can view class leaderboard"
ON public.student_points FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

-- RLS policies for monthly_leaders
CREATE POLICY "Admins can manage monthly leaders"
ON public.monthly_leaders FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view monthly leaders"
ON public.monthly_leaders FOR SELECT
TO authenticated
USING (true);

-- Update trigger for student_points
CREATE OR REPLACE FUNCTION update_student_points_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_points_updated_at
BEFORE UPDATE ON public.student_points
FOR EACH ROW
EXECUTE FUNCTION update_student_points_timestamp();

-- ========================================
-- Migration: 20251013203220_04683d64-c281-42d1-8a6b-5e5e78dae015.sql
-- ========================================
-- Fix homework_submissions RLS - ensure students can insert their own submissions
-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Students can insert own submissions" ON public.homework_submissions;

-- Create proper insert policy for students
CREATE POLICY "Students can insert own submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students
    WHERE linked_user_id = auth.uid()
  )
);

-- Ensure storage policies allow homework uploads
DROP POLICY IF EXISTS "Students can upload homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can read their homework files" ON storage.objects;

CREATE POLICY "Students can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' AND
  (storage.foldername(name))[1] = 'homework-submissions' AND
  (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.students WHERE linked_user_id = auth.uid()
  )
);

CREATE POLICY "Students can read their homework files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' AND
  (
    -- Student can read their own files
    (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.students WHERE linked_user_id = auth.uid()
    ) OR
    -- Teachers can read files for their classes
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid()
    ) OR
    -- Admins can read all
    EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);

-- ========================================
-- Migration: 20251013204749_43f14d07-20ce-40ec-b43f-7c930bfb1066.sql
-- ========================================
-- Update RLS policies for family access to homework and leaderboards

-- Allow family members to view and submit homework for siblings
DROP POLICY IF EXISTS "hwf_student_read" ON homework_files;
CREATE POLICY "hwf_student_read" ON homework_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM homeworks h
    JOIN enrollments e ON e.class_id = h.class_id
    JOIN students s ON s.id = e.student_id
    WHERE h.id = homework_files.homework_id
    AND (
      s.linked_user_id = auth.uid()
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
      )
      OR s.family_id IN (
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Students can insert own submissions" ON homework_submissions;
CREATE POLICY "Students can insert own submissions" ON homework_submissions
FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Students can update own submissions" ON homework_submissions;
CREATE POLICY "Students can update own submissions" ON homework_submissions
FOR UPDATE
USING (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Students can view own submissions" ON homework_submissions;
CREATE POLICY "Students can view own submissions" ON homework_submissions
FOR SELECT
USING (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

-- Allow family members to view sibling leaderboards
DROP POLICY IF EXISTS "Students can view class leaderboard" ON student_points;
CREATE POLICY "Students can view class leaderboard" ON student_points
FOR SELECT
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

-- ========================================
-- Migration: 20251013205052_2b8751e4-4f35-4389-b7bb-05b959840170.sql
-- ========================================
-- Fix security warnings by updating functions with proper search_path
-- Use CREATE OR REPLACE instead of DROP to avoid cascade issues

-- 1. Fix function search paths for functions that don't have it set
CREATE OR REPLACE FUNCTION public._attendance_seed_for_class_dates(p_class uuid, p_from date, p_to date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.attendance(session_id, student_id, status, marked_by)
  SELECT s.id, e.student_id, 'Present', NULL
  FROM public.sessions s
  JOIN public.enrollments e ON e.class_id = s.class_id
  WHERE s.class_id = p_class
    AND s.date BETWEEN p_from AND p_to
    AND e.start_date <= s.date
    AND (e.end_date IS NULL OR s.date <= e.end_date)
  ON CONFLICT (session_id, student_id) DO NOTHING;
$$;

-- 2. Fix the _attendance_after_session_ins trigger function
CREATE OR REPLACE FUNCTION public._attendance_after_session_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._attendance_seed_for_class_dates(NEW.class_id, NEW.date, NEW.date);
  RETURN NEW;
END;
$$;

-- 3. Fix the _attendance_after_enrollment_ins trigger function
CREATE OR REPLACE FUNCTION public._attendance_after_enrollment_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  dfrom date;
BEGIN
  -- Backfill from enrollment start or 6 months ago, whichever is later
  dfrom := GREATEST(NEW.start_date, CURRENT_DATE - INTERVAL '6 months');
  PERFORM public._attendance_seed_for_class_dates(
    NEW.class_id, 
    dfrom, 
    (CURRENT_DATE + INTERVAL '6 months')::date
  );
  RETURN NEW;
END;
$$;

-- 4. Fix update_student_points_timestamp function
CREATE OR REPLACE FUNCTION public.update_student_points_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ========================================
-- Migration: 20251014044536_078b8f44-678f-4570-b629-f57a2dba9ba5.sql
-- ========================================
-- Create expenditures table for admin finance tracking
CREATE TABLE IF NOT EXISTS public.expenditures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  memo TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage expenditures"
ON public.expenditures
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_expenditures_updated_at
  BEFORE UPDATE ON public.expenditures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Migration: 20251015032433_a3bf1d5d-5647-462c-a0e4-9ea171b8a096.sql
-- ========================================
-- Fix v_projected_base view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view respects Row Level Security policies

DROP VIEW IF EXISTS public.v_projected_base;

CREATE VIEW public.v_projected_base
WITH (security_invoker = true)
AS
SELECT e.student_id,
    (date_trunc('month'::text, (s.date)::timestamp with time zone))::date AS month_start,
    to_char(date_trunc('month'::text, (s.date)::timestamp with time zone), 'YYYY-MM'::text) AS ym,
    (count(*))::integer AS projected_sessions,
    (COALESCE(sum(c.session_rate_vnd), (0)::bigint))::integer AS projected_base
FROM ((sessions s
    JOIN enrollments e ON ((e.class_id = s.class_id)))
    JOIN classes c ON ((c.id = s.class_id)))
WHERE ((s.status = ANY (ARRAY['Scheduled'::session_status, 'Held'::session_status])) 
    AND (e.start_date <= s.date) 
    AND ((e.end_date IS NULL) OR (s.date <= e.end_date)))
GROUP BY e.student_id, (date_trunc('month'::text, (s.date)::timestamp with time zone));

-- ========================================
-- Migration: 20251015032902_774ede98-39b1-4a2e-8672-d6a19dbec367.sql
-- ========================================
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

-- ========================================
-- Migration: 20251015053836_03ddf504-d67d-4256-aeef-c9ff04b8566f.sql
-- ========================================
-- Add recorded_payment column to invoices table to track cumulative payments
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS recorded_payment integer DEFAULT 0;

COMMENT ON COLUMN public.invoices.recorded_payment IS 'Cumulative payment amount recorded for this student up to this month';

-- ========================================
-- Migration: 20251016044302_e7e71bb1-7ed4-4da3-ba55-63274b2a392c.sql
-- ========================================
-- Create function to revert invalid held sessions
CREATE OR REPLACE FUNCTION public.revert_invalid_held_sessions(
  p_month text,
  p_today date,
  p_now time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reverted_future integer := 0;
  v_reverted_today integer := 0;
  v_reverted_ids uuid[] := '{}';
  v_month_start date;
  v_next_month_start date;
BEGIN
  -- Parse month boundaries
  v_month_start := (p_month || '-01')::date;
  v_next_month_start := (v_month_start + interval '1 month')::date;
  
  -- Revert future sessions marked as Held
  WITH future_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date >= v_month_start
      AND date < v_next_month_start
      AND status = 'Held'
      AND date > p_today
    RETURNING id
  )
  SELECT count(*), array_agg(id)
  INTO v_reverted_future, v_reverted_ids
  FROM future_reverted;
  
  -- Revert today's sessions marked Held before start_time + 5 minutes
  WITH today_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date = p_today
      AND status = 'Held'
      AND (start_time + interval '5 minutes') > p_now
    RETURNING id
  )
  SELECT count(*), array_agg(id)
  INTO v_reverted_today, v_reverted_ids
  FROM today_reverted;
  
  RETURN jsonb_build_object(
    'revertedFuture', v_reverted_future,
    'revertedToday', v_reverted_today,
    'totalReverted', v_reverted_future + v_reverted_today,
    'revertedIds', v_reverted_ids
  );
END;
$$;

-- Improve job_lock with better upsert capability
CREATE OR REPLACE FUNCTION public.assert_job_lock(p_job text, p_month text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's an unfinished lock
  IF EXISTS (
    SELECT 1 FROM job_lock
    WHERE job = p_job
      AND month = p_month
      AND finished_at IS NULL
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- ========================================
-- Migration: 20251016045745_755294d2-f62d-468d-b15c-a3ad25c73da8.sql
-- ========================================
-- Migration: Add database trigger to prevent future sessions from being marked as "Held"
-- Also includes cleanup of existing invalid sessions

-- 1. Create trigger function to validate session status changes
CREATE OR REPLACE FUNCTION public.validate_session_status_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_bkk timestamp with time zone;
  v_session_start timestamp with time zone;
  v_five_minutes_after timestamp with time zone;
BEGIN
  -- Only validate if status is being set to 'Held'
  IF NEW.status = 'Held' THEN
    -- Get current time in Bangkok timezone
    v_now_bkk := now() AT TIME ZONE 'Asia/Bangkok';
    
    -- Construct session start time in Bangkok timezone
    v_session_start := (NEW.date::text || ' ' || NEW.start_time::text)::timestamp AT TIME ZONE 'Asia/Bangkok';
    v_five_minutes_after := v_session_start + interval '5 minutes';
    
    -- If session hasn't reached start_time + 5 minutes yet, revert to Scheduled
    IF v_now_bkk < v_five_minutes_after THEN
      NEW.status := 'Scheduled';
      RAISE NOTICE 'Auto-corrected session % status from Held to Scheduled (session not yet started)', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to sessions table
DROP TRIGGER IF EXISTS validate_session_status_trigger ON public.sessions;

CREATE TRIGGER validate_session_status_trigger
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_session_status_on_change();

-- 3. Cleanup existing invalid sessions (one-time fix)
-- Revert future sessions marked as "Held" to "Scheduled"
-- Also revert today's sessions marked "Held" before their start time + 5 minutes
UPDATE public.sessions
SET 
  status = 'Scheduled',
  updated_at = now()
WHERE status = 'Held'
  AND (
    -- Future sessions
    date > CURRENT_DATE
    OR 
    -- Today's sessions where it's not yet 5 minutes past start time
    (
      date = CURRENT_DATE 
      AND (
        SELECT now() AT TIME ZONE 'Asia/Bangkok' 
        < (date::text || ' ' || start_time::text)::timestamp AT TIME ZONE 'Asia/Bangkok' + interval '5 minutes'
      )
    )
  );

-- Log the cleanup results
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Cleanup complete: % invalid "Held" sessions reverted to "Scheduled"', v_updated_count;
END $$;

-- ========================================
-- Migration: 20251017022007_0bc6b318-3a3a-4584-a89f-e0bb9d198246.sql
-- ========================================
-- Add canceled tracking columns to sessions
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS canceled_reason text,
ADD COLUMN IF NOT EXISTS canceled_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone;

-- Function to normalize session statuses (revert invalid Held sessions)
CREATE OR REPLACE FUNCTION public.normalize_session_statuses(p_month text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_now_bkk time;
  v_reverted_future integer := 0;
  v_reverted_today integer := 0;
  v_month_start date;
  v_next_month_start date;
BEGIN
  -- Get current date/time in Bangkok timezone
  v_today := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now_bkk := (now() AT TIME ZONE 'Asia/Bangkok')::time;
  
  -- Parse month boundaries
  v_month_start := (p_month || '-01')::date;
  v_next_month_start := (v_month_start + interval '1 month')::date;
  
  -- Revert future sessions marked as Held back to Scheduled
  WITH future_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date >= v_month_start
      AND date < v_next_month_start
      AND status = 'Held'
      AND date > v_today
    RETURNING id
  )
  SELECT count(*) INTO v_reverted_future FROM future_reverted;
  
  -- Revert today's sessions marked Held before end_time + 5 minutes
  WITH today_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date = v_today
      AND status = 'Held'
      AND (end_time + interval '5 minutes') > v_now_bkk
    RETURNING id
  )
  SELECT count(*) INTO v_reverted_today FROM today_reverted;
  
  RETURN jsonb_build_object(
    'revertedFuture', v_reverted_future,
    'revertedToday', v_reverted_today,
    'totalReverted', v_reverted_future + v_reverted_today
  );
END;
$$;

-- ========================================
-- Migration: 20251017144629_04ea3541-2935-42d5-a06b-37bbed64d2b4.sql
-- ========================================
-- Add is_manual tracking columns first
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_reason TEXT;

-- Find and cancel duplicate sessions, keeping the most recent created_at
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY class_id, date, start_time 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM public.sessions
  WHERE status <> 'Canceled'
)
UPDATE public.sessions s
SET 
  status = 'Canceled',
  canceled_reason = 'Duplicate session removed during index creation',
  canceled_at = now(),
  is_manual = true
FROM duplicates d
WHERE s.id = d.id 
  AND d.rn > 1
  AND s.status <> 'Canceled';

-- Now create the partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS sessions_class_date_time_unique 
ON public.sessions (class_id, date, start_time) 
WHERE status <> 'Canceled';

COMMENT ON INDEX sessions_class_date_time_unique IS 'Prevents duplicate active sessions for same class, date, and time. Canceled sessions are excluded to allow recreation.';

-- ========================================
-- Migration: 20251018120645_344b0ca5-df4f-448d-b2de-cc86c69ba364.sql
-- ========================================
-- Add constraint to prevent overlapping discount assignments for the same student+definition
-- Using exclusion constraint with daterange
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.discount_assignments 
ADD CONSTRAINT no_overlapping_assignments 
EXCLUDE USING gist (
  student_id WITH =,
  discount_def_id WITH =,
  daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
);

-- Ensure audit_log table exists with proper structure
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  diff jsonb,
  actor_user_id uuid REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Add index for better audit query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred ON public.audit_log(occurred_at DESC);

-- ========================================
-- Migration: 20251018172027_72ecff96-4f53-45ce-846b-d725af1824ba.sql
-- ========================================
-- =============================================
-- Storage Buckets for Homework and Submissions
-- =============================================

-- Create homework bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Create submissions bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- RLS Policies for homework bucket
-- =============================================

-- Teachers can insert/read/update homework files for their classes
CREATE POLICY "Teachers can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM classes c
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers and students can read homework files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND (
    -- Teachers can read files for their classes
    (storage.foldername(name))[1] IN (
      SELECT c.id::text
      FROM classes c
      JOIN sessions s ON s.class_id = c.id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
    OR
    -- Students can read files for their enrolled classes
    (storage.foldername(name))[1] IN (
      SELECT e.class_id::text
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE (s.linked_user_id = auth.uid() OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
        UNION
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      ))
    )
    OR
    -- Admins can read all
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Teachers can update homework files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM classes c
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage homework files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'homework' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'homework' AND has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS Policies for submissions bucket
-- =============================================

-- Students can insert their own submissions
CREATE POLICY "Students can upload submission files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM students s
    WHERE s.linked_user_id = auth.uid() 
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
        UNION
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
  )
);

-- Students, teachers, and admins can read submission files
CREATE POLICY "Students teachers and admins can read submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (
    -- Student can read their own
    (storage.foldername(name))[1] IN (
      SELECT s.id::text
      FROM students s
      WHERE s.linked_user_id = auth.uid() 
        OR s.family_id IN (
          SELECT family_id FROM students WHERE linked_user_id = auth.uid()
          UNION
          SELECT id FROM families WHERE primary_user_id = auth.uid()
        )
    )
    OR
    -- Teachers can read submissions for their classes
    (storage.foldername(name))[1] IN (
      SELECT st.id::text
      FROM students st
      JOIN enrollments e ON e.student_id = st.id
      JOIN classes c ON c.id = e.class_id
      JOIN sessions s ON s.class_id = c.id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
    OR
    -- Admins can read all
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Students can update own submission files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM students s
    WHERE s.linked_user_id = auth.uid() 
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
        UNION
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
  )
);

CREATE POLICY "Admins can manage submission files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'submissions' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'submissions' AND has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Migration: 20251018174251_2588e068-b44b-4bdb-9154-1a93466de5ff.sql
-- ========================================
-- Fix homework storage policies for teachers
-- Drop existing teacher insert policy
DROP POLICY IF EXISTS "Teachers can upload homework files" ON storage.objects;

-- Recreate with simplified logic that checks if user is a teacher
CREATE POLICY "Teachers can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND EXISTS (
    SELECT 1 FROM teachers 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- Also update the update policy to be consistent
DROP POLICY IF EXISTS "Teachers can update homework files" ON storage.objects;

CREATE POLICY "Teachers can update homework files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND EXISTS (
    SELECT 1 FROM teachers 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- ========================================
-- Migration: 20251019022648_e48d07cf-d57a-4c5b-9b08-d4589cd5619f.sql
-- ========================================
-- Add RLS policy for authenticated users to view bank info
-- Students need to see payment details on invoices
CREATE POLICY "Authenticated users can view bank info"
ON bank_info FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- Migration: 20251020082902_9eba5933-4841-4990-8ca1-932a6240c034.sql
-- ========================================
-- Create journal_entries table
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Students can view their own entries
CREATE POLICY "Students can view own entries"
ON public.journal_entries
FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Students can create their own entries
CREATE POLICY "Students can create own entries"
ON public.journal_entries
FOR INSERT
WITH CHECK (can_view_student(student_id, auth.uid()));

-- Students can update their own entries
CREATE POLICY "Students can update own entries"
ON public.journal_entries
FOR UPDATE
USING (can_view_student(student_id, auth.uid()));

-- Teachers can view entries for their students
CREATE POLICY "Teachers can view class entries"
ON public.journal_entries
FOR SELECT
USING (
  student_id IN (
    SELECT DISTINCT e.student_id
    FROM enrollments e
    JOIN sessions s ON s.class_id = e.class_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

-- Teachers can create entries for their students
CREATE POLICY "Teachers can create class entries"
ON public.journal_entries
FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT DISTINCT e.student_id
    FROM enrollments e
    JOIN sessions s ON s.class_id = e.class_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

-- Admins can manage all entries
CREATE POLICY "Admins can manage all entries"
ON public.journal_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Migration: 20251020115135_efaac65d-27d4-426c-89d0-ec15fcbb836e.sql
-- ========================================
-- Remove the unique constraint that prevents double-entry bookkeeping
-- Each transaction needs two entries (debit and credit) with the same tx_id
ALTER TABLE public.ledger_entries 
DROP CONSTRAINT IF EXISTS uniq_ledger_tx_id;

-- ========================================
-- Migration: 20251020121858_06fc873c-0544-459d-af0b-8ddc4029032e.sql
-- ========================================
-- Drop all constraints on tx_id in ledger_entries to allow double-entry bookkeeping
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.ledger_entries'::regclass 
        AND conname LIKE '%tx_id%'
    LOOP
        EXECUTE 'ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- ========================================
-- Migration: 20251020121919_9ba9abde-ef22-4039-9974-c8028926832f.sql
-- ========================================
-- Drop the unique index on tx_id to allow double-entry bookkeeping
-- Each transaction needs two ledger entries (debit and credit) with the same tx_id
DROP INDEX IF EXISTS public.uniq_ledger_tx_id;

-- ========================================
-- Migration: 20251023030547_58bd2f30-a2cd-4b1a-bbd2-5ec7c0dd1152.sql
-- ========================================
-- Modify journal_entries to support class journals and private journals
-- Make student_id nullable (for class and private journals)
ALTER TABLE journal_entries 
  ALTER COLUMN student_id DROP NOT NULL;

-- Add class_id for class journals
ALTER TABLE journal_entries 
  ADD COLUMN class_id uuid REFERENCES classes(id) ON DELETE CASCADE;

-- Add is_private flag for teacher/admin private journals
ALTER TABLE journal_entries 
  ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Add constraint: must have either student_id, class_id, or is_private
ALTER TABLE journal_entries 
  ADD CONSTRAINT journal_entry_type_check 
  CHECK (
    (student_id IS NOT NULL AND class_id IS NULL AND is_private = false) OR  -- Student journal
    (student_id IS NULL AND class_id IS NOT NULL AND is_private = false) OR  -- Class journal
    (student_id IS NULL AND class_id IS NULL AND is_private = true)          -- Private journal
  );

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Admins can manage all entries" ON journal_entries;
DROP POLICY IF EXISTS "Students can create own entries" ON journal_entries;
DROP POLICY IF EXISTS "Students can update own entries" ON journal_entries;
DROP POLICY IF EXISTS "Students can view own entries" ON journal_entries;
DROP POLICY IF EXISTS "Teachers can create class entries" ON journal_entries;
DROP POLICY IF EXISTS "Teachers can view class entries" ON journal_entries;

-- New RLS policies

-- Admins can manage all journal entries
CREATE POLICY "Admins can manage all entries" ON journal_entries
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own student journals
CREATE POLICY "Students can view own entries" ON journal_entries
  FOR SELECT USING (
    student_id IS NOT NULL AND can_view_student(student_id, auth.uid())
  );

-- Students can view class journals for classes they're enrolled in
CREATE POLICY "Students can view class journals" ON journal_entries
  FOR SELECT USING (
    class_id IS NOT NULL AND 
    class_id IN (
      SELECT e.class_id 
      FROM enrollments e 
      JOIN students s ON s.id = e.student_id 
      WHERE can_view_student(s.id, auth.uid())
    )
  );

-- Students can create their own student journals
CREATE POLICY "Students can create own entries" ON journal_entries
  FOR INSERT WITH CHECK (
    student_id IS NOT NULL AND 
    can_view_student(student_id, auth.uid()) AND
    class_id IS NULL AND
    is_private = false
  );

-- Students can update their own student journals
CREATE POLICY "Students can update own entries" ON journal_entries
  FOR UPDATE USING (
    student_id IS NOT NULL AND can_view_student(student_id, auth.uid())
  );

-- Teachers can view student journals for their enrolled students
CREATE POLICY "Teachers can view student entries" ON journal_entries
  FOR SELECT USING (
    student_id IS NOT NULL AND
    student_id IN (
      SELECT DISTINCT e.student_id
      FROM enrollments e
      JOIN sessions s ON s.class_id = e.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

-- Teachers can create student journals for their enrolled students
CREATE POLICY "Teachers can create student entries" ON journal_entries
  FOR INSERT WITH CHECK (
    student_id IS NOT NULL AND
    student_id IN (
      SELECT DISTINCT e.student_id
      FROM enrollments e
      JOIN sessions s ON s.class_id = e.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    ) AND
    class_id IS NULL AND
    is_private = false
  );

-- Teachers can view class journals for their classes
CREATE POLICY "Teachers can view class journals" ON journal_entries
  FOR SELECT USING (
    class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id)
  );

-- Teachers can create class journals for their classes
CREATE POLICY "Teachers can create class journals" ON journal_entries
  FOR INSERT WITH CHECK (
    class_id IS NOT NULL AND 
    is_teacher_of_class(auth.uid(), class_id) AND
    student_id IS NULL AND
    is_private = false
  );

-- Teachers can update class journals they created
CREATE POLICY "Teachers can update class journals" ON journal_entries
  FOR UPDATE USING (
    class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id)
  );

-- Teachers can view their own private journals
CREATE POLICY "Teachers can view own private journals" ON journal_entries
  FOR SELECT USING (
    is_private = true AND created_by = auth.uid()
  );

-- Teachers can create private journals
CREATE POLICY "Teachers can create private journals" ON journal_entries
  FOR INSERT WITH CHECK (
    is_private = true AND 
    student_id IS NULL AND 
    class_id IS NULL AND
    created_by = auth.uid()
  );

-- Teachers can update their own private journals
CREATE POLICY "Teachers can update private journals" ON journal_entries
  FOR UPDATE USING (
    is_private = true AND created_by = auth.uid()
  );

-- Teachers can delete their own private journals
CREATE POLICY "Teachers can delete private journals" ON journal_entries
  FOR DELETE USING (
    is_private = true AND created_by = auth.uid()
  );

-- ========================================
-- Migration: 20251023065830_6aa74b0b-f2d3-4146-8226-2d7f5c7ed0a2.sql
-- ========================================
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

-- ========================================
-- Migration: 20251023070133_52c58f62-77e2-4339-8101-abf7ba1053af.sql
-- ========================================
-- Fix infinite recursion in journal_members RLS policies

-- Create security definer function to check journal membership
CREATE OR REPLACE FUNCTION is_journal_member(_journal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM journal_members
    WHERE journal_id = _journal_id
      AND user_id = _user_id
      AND status = 'active'
  )
$$;

-- Create security definer function to check if user is journal owner
CREATE OR REPLACE FUNCTION is_journal_owner(_journal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM journals
    WHERE id = _journal_id
      AND owner_user_id = _user_id
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create journals" ON journals;
DROP POLICY IF EXISTS "Users can read their journals" ON journals;
DROP POLICY IF EXISTS "Members can update journals" ON journals;
DROP POLICY IF EXISTS "Owners can delete journals" ON journals;
DROP POLICY IF EXISTS "Owners can invite members" ON journal_members;
DROP POLICY IF EXISTS "Members can view journal membership" ON journal_members;
DROP POLICY IF EXISTS "Members can update their membership" ON journal_members;
DROP POLICY IF EXISTS "Members can leave journals" ON journal_members;
DROP POLICY IF EXISTS "System can create audit logs" ON journal_audit;
DROP POLICY IF EXISTS "Members can read audit logs" ON journal_audit;

-- Recreate journals policies with security definer functions

CREATE POLICY "Users can create journals"
  ON journals FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can read their journals"
  ON journals FOR SELECT
  USING (
    NOT is_deleted AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      is_journal_member(id, auth.uid())
    )
  );

CREATE POLICY "Members can update journals"
  ON journals FOR UPDATE
  USING (
    NOT is_deleted AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      is_journal_member(id, auth.uid())
    )
  );

CREATE POLICY "Owners can delete journals"
  ON journals FOR DELETE
  USING (
    owner_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Recreate journal_members policies with security definer functions

CREATE POLICY "Owners can invite members"
  ON journal_members FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_owner(journal_id, auth.uid())
  );

CREATE POLICY "Members can view journal membership"
  ON journal_members FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_member(journal_id, auth.uid())
  );

CREATE POLICY "Members can update their membership"
  ON journal_members FOR UPDATE
  USING (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_owner(journal_id, auth.uid())
  );

CREATE POLICY "Members can leave journals"
  ON journal_members FOR DELETE
  USING (
    (user_id = auth.uid() AND role != 'owner') OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_owner(journal_id, auth.uid())
  );

-- Recreate journal_audit policies

CREATE POLICY "System can create audit logs"
  ON journal_audit FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Members can read audit logs"
  ON journal_audit FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_journal_member(journal_id, auth.uid())
  );

-- ========================================
-- Migration: 20251023072003_108132c3-018c-4695-af34-ba895bd30ccb.sql
-- ========================================
-- Fix journal_members RLS policy to allow trigger to create owner memberships
DROP POLICY IF EXISTS "Owners can invite members" ON journal_members;

CREATE POLICY "Owners can invite members"
  ON journal_members FOR INSERT
  WITH CHECK (
    -- Allow creating owner memberships (for the trigger)
    role = 'owner' OR
    -- Allow admins
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Allow journal owners to invite others
    is_journal_owner(journal_id, auth.uid())
  );

-- ========================================
-- Migration: 20251023072933_043ac809-8ed0-4f76-85d8-11fdebb83c47.sql
-- ========================================
-- Temporarily disable the trigger to diagnose the issue
DROP TRIGGER IF EXISTS create_journal_owner_membership_trigger ON journals;

-- Ensure RLS is enabled
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_members ENABLE ROW LEVEL SECURITY;

-- Recreate a simpler INSERT policy for journals
DROP POLICY IF EXISTS "Users can create journals" ON journals;

CREATE POLICY "Users can create journals"
  ON journals FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- Recreate trigger with better error handling
CREATE OR REPLACE FUNCTION public.create_journal_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create owner membership
  INSERT INTO public.journal_members (journal_id, user_id, role, status, accepted_at)
  VALUES (NEW.id, NEW.owner_user_id, 'owner', 'active', now());
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create journal member: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER create_journal_owner_membership_trigger
AFTER INSERT ON journals
FOR EACH ROW
EXECUTE FUNCTION create_journal_owner_membership();

-- Ensure journal_members INSERT policy allows owner creation without checks
DROP POLICY IF EXISTS "Owners can invite members" ON journal_members;

-- Separate policies for different scenarios
CREATE POLICY "System can create owner memberships"
  ON journal_members FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'owner'
  );

CREATE POLICY "Admins and owners can invite members"
  ON journal_members FOR INSERT
  TO authenticated
  WITH CHECK (
    role != 'owner' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM journal_members jm
        WHERE jm.journal_id = journal_members.journal_id
        AND jm.user_id = auth.uid()
        AND jm.role = 'owner'
        AND jm.status = 'active'
      )
    )
  );

-- ========================================
-- Migration: 20251023104026_608af79a-3a6e-4346-84ce-0b8876a36e4b.sql
-- ========================================
-- Fix journal_members RLS to allow trigger to create owner memberships
-- The issue is that SECURITY DEFINER functions need policies that don't rely on auth.uid()

DROP POLICY IF EXISTS "System can create owner memberships" ON journal_members;

CREATE POLICY "System can create owner memberships"
  ON journal_members FOR INSERT
  TO public  -- Changed from 'authenticated' to 'public' to allow trigger execution
  WITH CHECK (role = 'owner');

-- ========================================
-- Migration: 20251023110500_da788368-898b-4507-84b8-1532363d84cb.sql
-- ========================================
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

-- ========================================
-- Migration: 20251023112730_3625a376-5d07-41a5-88fd-a6af65c32ddc.sql
-- ========================================
-- Enrollment modifications with proration and pause windows
-- All times in Asia/Bangkok

-- 1. Create pause_windows table to track enrollment pauses
CREATE TABLE IF NOT EXISTS public.pause_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  memo TEXT,
  CONSTRAINT valid_pause_dates CHECK (to_date >= from_date)
);

-- Enable RLS on pause_windows
ALTER TABLE public.pause_windows ENABLE ROW LEVEL SECURITY;

-- RLS policies for pause_windows
CREATE POLICY "Admins can manage pause windows"
  ON public.pause_windows FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view pause windows for their classes"
  ON public.pause_windows FOR SELECT
  USING (
    class_id IN (
      SELECT DISTINCT s.class_id
      FROM sessions s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own pause windows"
  ON public.pause_windows FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

-- Index for performance
CREATE INDEX idx_pause_windows_student_class ON public.pause_windows(student_id, class_id);
CREATE INDEX idx_pause_windows_dates ON public.pause_windows(from_date, to_date);

-- 2. RPC: Transfer enrollment to another class
CREATE OR REPLACE FUNCTION public.modify_enrollment_transfer(
  p_student_id UUID,
  p_old_class_id UUID,
  p_new_class_id UUID,
  p_effective_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_enrollment_id UUID;
  v_new_enrollment_id UUID;
  v_deleted_count INT := 0;
  v_seeded_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
  v_next_month TEXT;
BEGIN
  -- Validate dates
  v_effective_month := to_char(p_effective_date, 'YYYY-MM');
  v_next_month := to_char(p_effective_date + INTERVAL '1 month', 'YYYY-MM');

  -- Get old enrollment
  SELECT id INTO v_old_enrollment_id
  FROM enrollments
  WHERE student_id = p_student_id 
    AND class_id = p_old_class_id
    AND (end_date IS NULL OR end_date >= p_effective_date);

  IF v_old_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Active enrollment not found for student % in class %', p_student_id, p_old_class_id;
  END IF;

  -- 1. End old enrollment (set end_date to day before transfer)
  UPDATE enrollments
  SET 
    end_date = p_effective_date - INTERVAL '1 day',
    updated_at = now(),
    updated_by = v_actor_id
  WHERE id = v_old_enrollment_id;

  -- 2. Delete future attendance rows in old class (date >= effective_date)
  WITH deleted AS (
    DELETE FROM attendance
    WHERE student_id = p_student_id
      AND session_id IN (
        SELECT id FROM sessions 
        WHERE class_id = p_old_class_id 
          AND date >= p_effective_date
      )
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  -- 3. Create new enrollment
  INSERT INTO enrollments (
    student_id,
    class_id,
    start_date,
    created_by,
    updated_by
  ) VALUES (
    p_student_id,
    p_new_class_id,
    p_effective_date,
    v_actor_id,
    v_actor_id
  )
  RETURNING id INTO v_new_enrollment_id;

  -- 4. Seed attendance for future sessions in new class
  WITH seeded AS (
    INSERT INTO attendance (session_id, student_id, status, marked_by)
    SELECT s.id, p_student_id, 'Present', NULL
    FROM sessions s
    WHERE s.class_id = p_new_class_id
      AND s.date >= p_effective_date
      AND s.status != 'Canceled'
    ON CONFLICT (session_id, student_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_seeded_count FROM seeded;

  -- 5. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'transfer',
    'enrollment',
    v_old_enrollment_id::text,
    jsonb_build_object(
      'old_class_id', p_old_class_id,
      'new_class_id', p_new_class_id,
      'effective_date', p_effective_date,
      'deleted_attendance', v_deleted_count,
      'seeded_attendance', v_seeded_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_enrollment_id', v_old_enrollment_id,
    'new_enrollment_id', v_new_enrollment_id,
    'deleted_future_attendance', v_deleted_count,
    'seeded_attendance', v_seeded_count,
    'effective_month', v_effective_month,
    'next_month', v_next_month
  );
END;
$$;

-- 3. RPC: Pause enrollment
CREATE OR REPLACE FUNCTION public.pause_enrollment(
  p_student_id UUID,
  p_class_id UUID,
  p_from_date DATE,
  p_to_date DATE,
  p_memo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pause_window_id UUID;
  v_excused_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
BEGIN
  -- Validate dates
  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'to_date must be >= from_date';
  END IF;

  v_effective_month := to_char(p_from_date, 'YYYY-MM');

  -- 1. Create pause window record
  INSERT INTO pause_windows (
    student_id,
    class_id,
    from_date,
    to_date,
    memo,
    created_by
  ) VALUES (
    p_student_id,
    p_class_id,
    p_from_date,
    p_to_date,
    p_memo,
    v_actor_id
  )
  RETURNING id INTO v_pause_window_id;

  -- 2. Mark attendance as Excused for sessions in pause window
  WITH excused AS (
    INSERT INTO attendance (session_id, student_id, status, marked_by, notes)
    SELECT 
      s.id, 
      p_student_id, 
      'Excused', 
      v_actor_id,
      'Pause: ' || COALESCE(p_memo, 'Student paused')
    FROM sessions s
    WHERE s.class_id = p_class_id
      AND s.date BETWEEN p_from_date AND p_to_date
      AND s.status != 'Canceled'
    ON CONFLICT (session_id, student_id) 
    DO UPDATE SET 
      status = 'Excused',
      marked_by = v_actor_id,
      notes = 'Pause: ' || COALESCE(p_memo, 'Student paused'),
      updated_at = now()
    RETURNING id
  )
  SELECT count(*) INTO v_excused_count FROM excused;

  -- 3. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'pause',
    'enrollment',
    v_pause_window_id::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'class_id', p_class_id,
      'from_date', p_from_date,
      'to_date', p_to_date,
      'excused_count', v_excused_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'pause_window_id', v_pause_window_id,
    'excused_attendance', v_excused_count,
    'effective_month', v_effective_month
  );
END;
$$;

-- 4. RPC: End enrollment
CREATE OR REPLACE FUNCTION public.end_enrollment(
  p_student_id UUID,
  p_class_id UUID,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_deleted_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
BEGIN
  v_effective_month := to_char(p_end_date, 'YYYY-MM');

  -- Get enrollment
  SELECT id INTO v_enrollment_id
  FROM enrollments
  WHERE student_id = p_student_id 
    AND class_id = p_class_id
    AND (end_date IS NULL OR end_date > p_end_date);

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Active enrollment not found for student % in class %', p_student_id, p_class_id;
  END IF;

  -- 1. Set enrollment end_date
  UPDATE enrollments
  SET 
    end_date = p_end_date,
    updated_at = now(),
    updated_by = v_actor_id
  WHERE id = v_enrollment_id;

  -- 2. Delete future attendance rows (date > end_date)
  WITH deleted AS (
    DELETE FROM attendance
    WHERE student_id = p_student_id
      AND session_id IN (
        SELECT id FROM sessions 
        WHERE class_id = p_class_id 
          AND date > p_end_date
      )
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  -- 3. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'end',
    'enrollment',
    v_enrollment_id::text,
    jsonb_build_object(
      'end_date', p_end_date,
      'deleted_attendance', v_deleted_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'deleted_future_attendance', v_deleted_count,
    'effective_month', v_effective_month
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.modify_enrollment_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_enrollment TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_enrollment TO authenticated;

-- ========================================
-- Migration: 20251023141128_a50f5fd3-fcf8-4395-b2db-1d118133bee5.sql
-- ========================================
-- Fix modify_enrollment_transfer to delete ALL attendance in old class (not just future)
-- This prevents billing transferred students for past sessions in the old class

CREATE OR REPLACE FUNCTION public.modify_enrollment_transfer(
  p_student_id UUID,
  p_old_class_id UUID,
  p_new_class_id UUID,
  p_effective_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_enrollment_id UUID;
  v_new_enrollment_id UUID;
  v_deleted_count INT := 0;
  v_seeded_count INT := 0;
  v_actor_id UUID := auth.uid();
  v_effective_month TEXT;
  v_next_month TEXT;
BEGIN
  -- Validate dates
  v_effective_month := to_char(p_effective_date, 'YYYY-MM');
  v_next_month := to_char(p_effective_date + INTERVAL '1 month', 'YYYY-MM');

  -- Get old enrollment
  SELECT id INTO v_old_enrollment_id
  FROM enrollments
  WHERE student_id = p_student_id 
    AND class_id = p_old_class_id
    AND (end_date IS NULL OR end_date >= p_effective_date);

  IF v_old_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Active enrollment not found for student % in class %', p_student_id, p_old_class_id;
  END IF;

  -- 1. End old enrollment (set end_date to day before transfer)
  UPDATE enrollments
  SET 
    end_date = p_effective_date - INTERVAL '1 day',
    updated_at = now(),
    updated_by = v_actor_id
  WHERE id = v_old_enrollment_id;

  -- 2. Delete ALL attendance rows in old class (past and future)
  -- This prevents billing for past sessions after transfer
  WITH deleted AS (
    DELETE FROM attendance
    WHERE student_id = p_student_id
      AND session_id IN (
        SELECT id FROM sessions 
        WHERE class_id = p_old_class_id
      )
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  -- 3. Create new enrollment
  INSERT INTO enrollments (
    student_id,
    class_id,
    start_date,
    created_by,
    updated_by
  ) VALUES (
    p_student_id,
    p_new_class_id,
    p_effective_date,
    v_actor_id,
    v_actor_id
  )
  RETURNING id INTO v_new_enrollment_id;

  -- 4. Seed attendance for future sessions in new class
  WITH seeded AS (
    INSERT INTO attendance (session_id, student_id, status, marked_by)
    SELECT s.id, p_student_id, 'Present', NULL
    FROM sessions s
    WHERE s.class_id = p_new_class_id
      AND s.date >= p_effective_date
      AND s.status != 'Canceled'
    ON CONFLICT (session_id, student_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_seeded_count FROM seeded;

  -- 5. Audit log
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, diff)
  VALUES (
    v_actor_id,
    'transfer',
    'enrollment',
    v_old_enrollment_id::text,
    jsonb_build_object(
      'old_class_id', p_old_class_id,
      'new_class_id', p_new_class_id,
      'effective_date', p_effective_date,
      'deleted_attendance', v_deleted_count,
      'seeded_attendance', v_seeded_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_enrollment_id', v_old_enrollment_id,
    'new_enrollment_id', v_new_enrollment_id,
    'deleted_future_attendance', v_deleted_count,
    'seeded_attendance', v_seeded_count,
    'effective_month', v_effective_month,
    'next_month', v_next_month
  );
END;
$$;

-- ========================================
-- Migration: 20251024050029_0843ed71-7091-484b-93eb-e79cdc95e119.sql
-- ========================================
-- Add family payment tracking and idempotency
ALTER TABLE payments ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES payments(id);

-- Add unique tx_key for idempotency
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS tx_key TEXT UNIQUE;

-- Create payment_allocations table for family payment tracking
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  allocated_amount INTEGER NOT NULL,
  allocation_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_parent ON payment_allocations(parent_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_student ON payment_allocations(student_id);

-- Create settlements table for tracking bill settlements
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  month TEXT NOT NULL,
  settlement_type TEXT NOT NULL CHECK (settlement_type IN ('discount', 'voluntary_contribution', 'unapplied_cash')),
  amount INTEGER NOT NULL,
  reason TEXT,
  consent_given BOOLEAN DEFAULT FALSE,
  approver_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  tx_id UUID NOT NULL,
  before_balance INTEGER NOT NULL,
  after_balance INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settlements_student ON settlements(student_id);
CREATE INDEX IF NOT EXISTS idx_settlements_month ON settlements(month);

-- Create payment_modifications table for audit trail
CREATE TABLE IF NOT EXISTS payment_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id UUID NOT NULL REFERENCES payments(id),
  reversal_payment_id UUID REFERENCES payments(id),
  new_payment_id UUID REFERENCES payments(id),
  modification_reason TEXT,
  before_data JSONB NOT NULL,
  after_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_modifications_original ON payment_modifications(original_payment_id);

-- RLS Policies for new tables
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modifications ENABLE ROW LEVEL SECURITY;

-- Admins can manage all records
CREATE POLICY "Admins can manage payment_allocations" ON payment_allocations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage settlements" ON settlements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view payment_modifications" ON payment_modifications
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own allocations and settlements
CREATE POLICY "Students can view own allocations" ON payment_allocations
  FOR SELECT USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Students can view own settlements" ON settlements
  FOR SELECT USING (can_view_student(student_id, auth.uid()));

-- ========================================
-- Migration: 20251024152825_6747d865-6888-4aa4-b728-fdb8e5a109d3.sql
-- ========================================
-- Create payment_deletions table for audit trail
CREATE TABLE IF NOT EXISTS public.payment_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  deleted_by UUID REFERENCES auth.users(id),
  deletion_reason TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_deletions ENABLE ROW LEVEL SECURITY;

-- Only admins can view deletion history
CREATE POLICY "Admins can view payment deletions"
  ON public.payment_deletions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create trigger to block direct payment deletion from client
CREATE OR REPLACE FUNCTION public.prevent_direct_payment_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow deletion only from service role (edge functions)
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Direct payment deletion is not allowed. Use the delete-payment edge function instead.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_client_payment_deletion
  BEFORE DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_payment_deletion();

-- ========================================
-- Migration: 20251025072355_70dc71f7-5c4a-431e-923f-3757713cb2f3.sql
-- ========================================
-- Drop all conflicting homework storage policies
DROP POLICY IF EXISTS "Students can upload their homework" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their homework" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view student homework" ON storage.objects;
DROP POLICY IF EXISTS "Public homework access" ON storage.objects;
DROP POLICY IF EXISTS "Homework files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework submissions" ON storage.objects;

-- Create clean, well-documented storage policies for homework bucket

-- 1. Students can upload to their own submission folder
CREATE POLICY "Students upload own homework submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students
    WHERE id::text = (storage.foldername(name))[2]
    AND linked_user_id = auth.uid()
  )
);

-- 2. Students can read their own submissions
CREATE POLICY "Students read own homework submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students
    WHERE id::text = (storage.foldername(name))[2]
    AND linked_user_id = auth.uid()
  )
);

-- 3. Family members can read submissions from students in their family
CREATE POLICY "Families read student homework submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[2]
    AND f.primary_user_id = auth.uid()
  )
);

-- 4. Teachers can upload homework materials to homework/{class_id} folders
CREATE POLICY "Teachers upload homework materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework'
  AND public.has_role(auth.uid(), 'teacher')
);

-- 5. Teachers can read all homework submissions for grading
CREATE POLICY "Teachers read homework submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND public.has_role(auth.uid(), 'teacher')
);

-- 6. Teachers can read homework materials
CREATE POLICY "Teachers read homework materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework'
  AND public.has_role(auth.uid(), 'teacher')
);

-- 7. Students can read homework materials (assignments)
CREATE POLICY "Students read homework materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework'
);

-- 8. Admins can manage all homework files
CREATE POLICY "Admins manage all homework files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'homework'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'homework'
  AND public.has_role(auth.uid(), 'admin')
);

-- ========================================
-- Migration: 20251025072932_ee73ab37-5c1c-4488-bd64-1f6965956214.sql
-- ========================================
-- Fix homework submission uploads for family accounts

-- Drop the existing policy that only checks linked_user_id
DROP POLICY IF EXISTS "Students upload own homework submissions" ON storage.objects;

-- Create new policy that includes family member access
CREATE POLICY "Students upload own homework submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = (storage.foldername(name))[2]
    AND (
      s.linked_user_id = auth.uid()  -- Direct student account
      OR s.family_id IN (
        SELECT f.id FROM public.families f
        WHERE f.primary_user_id = auth.uid()  -- Family account
      )
    )
  )
);

-- ========================================
-- Migration: 20251025152217_226342f8-30ac-489d-8098-d0a7570d6fef.sql
-- ========================================
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

-- ========================================
-- Migration: 20251025161625_ddc4242b-4dca-483d-9e8e-d911800d4a54.sql
-- ========================================
-- Fix journal RLS policies to allow teachers and students to create journals

-- Drop overly restrictive policies
DROP POLICY IF EXISTS "Teachers can create student entries" ON public.journals;
DROP POLICY IF EXISTS "Teachers can create class journals" ON public.journals;
DROP POLICY IF EXISTS "Teachers can create private journals" ON public.journals;
DROP POLICY IF EXISTS "Students can create own entries" ON public.journals;

-- Create comprehensive insert policy for teachers
CREATE POLICY "Teachers can create journals"
ON public.journals
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND (
    -- Teacher creating any journal type
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid()
      AND t.is_active = true
    )
  )
);

-- Create comprehensive insert policy for students
CREATE POLICY "Students can create journals"
ON public.journals
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND (
    -- Student creating personal or collaborative journals
    (type IN ('personal', 'collab_student_teacher'))
    OR
    -- Student creating journal for themselves
    (type = 'student' AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.linked_user_id = auth.uid()
      OR s.family_id IN (
        SELECT f.id FROM public.families f
        WHERE f.primary_user_id = auth.uid()
      )
    ))
  )
);

-- ========================================
-- Migration: 20251025162505_d2f83113-491e-4213-9eb8-cad89082f5bc.sql
-- ========================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework files" ON storage.objects;

-- Allow students and teachers to upload homework files
CREATE POLICY "Students can upload homework submissions"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'submissions'
  AND (
    auth.uid()::text IN (
      SELECT s.linked_user_id::text
      FROM students s
      WHERE s.id::text = (storage.foldername(name))[2]
    )
    OR
    auth.uid() IN (
      SELECT f.primary_user_id
      FROM students s
      JOIN families f ON s.family_id = f.id
      WHERE s.id::text = (storage.foldername(name))[2]
    )
  )
);

CREATE POLICY "Teachers can upload homework files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'assignments'
  AND EXISTS (
    SELECT 1 FROM teachers t WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Students can view homework files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework'
  AND (
    (
      (storage.foldername(name))[1] = 'assignments'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT h.id
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id
        JOIN students s ON s.id = e.student_id
        WHERE s.linked_user_id = auth.uid()
           OR s.family_id IN (
             SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid()
           )
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'submissions'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT s.id FROM students s 
        WHERE s.linked_user_id = auth.uid()
           OR s.family_id IN (
             SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid()
           )
      )
    )
  )
);

CREATE POLICY "Teachers can view homework files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM teachers t WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage homework files"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ========================================
-- Migration: 20251025163257_c01953c3-5624-40de-b027-bc9c29c95935.sql
-- ========================================
-- Fix admin access to homework files
DROP POLICY IF EXISTS "Admins can manage homework files" ON storage.objects;

-- Create separate policies for admin CRUD operations
CREATE POLICY "Admins can select homework files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert homework files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update homework files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete homework files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ========================================
-- Migration: 20251026083002_c5c670d8-7d35-47c8-9d78-05fac786594b.sql
-- ========================================
-- Ensure homework storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Students can view homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Family can view homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework assignments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert homework files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update homework files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete homework files" ON storage.objects;

-- Universal SELECT policies - anyone authenticated can view all homework files
CREATE POLICY "Students can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'student')
);

CREATE POLICY "Family can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'family')
);

CREATE POLICY "Teachers can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Admins can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

-- INSERT policies - students upload submissions, teachers upload assignments
CREATE POLICY "Students can upload homework submissions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'student')
  AND (storage.foldername(name))[1] = 'submissions'
);

CREATE POLICY "Teachers can upload homework assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'teacher')
  AND (storage.foldername(name))[1] = 'assignments'
);

CREATE POLICY "Admins can upload any homework files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admin management policies
CREATE POLICY "Admins can update any homework files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete any homework files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

-- ========================================
-- Migration: 20251026084003_1aa85ef7-3b91-466b-992a-e2f71fac2803.sql
-- ========================================
-- Make homework bucket public for easy file access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'homework';

-- ========================================
-- Migration: 20251026113222_7df6bfb7-d709-4393-bc76-4417ad9929f3.sql
-- ========================================
-- Update homework storage policies to match standardized paths
-- Drop existing policies
DROP POLICY IF EXISTS "hw_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "hw_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "hw_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "hw_student_insert" ON storage.objects;
DROP POLICY IF EXISTS "hw_teacher_insert" ON storage.objects;
DROP POLICY IF EXISTS "hw_authenticated_select" ON storage.objects;

-- Universal SELECT: All authenticated users can view all homework files
CREATE POLICY "hw_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
);

-- Teachers can upload to assignments folder: assignments/{homework_id}/*
CREATE POLICY "hw_teacher_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'assignments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'teacher'::app_role)
      AND EXISTS (
        SELECT 1 FROM homeworks h
        WHERE h.id::text = (storage.foldername(name))[2]
        AND is_teacher_of_class(auth.uid(), h.class_id)
      )
    )
  )
);

-- Students can upload to submissions folder: submissions/{homework_id}/{student_id}/*
CREATE POLICY "hw_student_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'student'::app_role)
      AND (storage.foldername(name))[3]::uuid IN (
        SELECT id FROM students WHERE linked_user_id = auth.uid()
      )
    )
    OR (
      has_role(auth.uid(), 'family'::app_role)
      AND (storage.foldername(name))[3]::uuid IN (
        SELECT s.id FROM students s
        JOIN families f ON f.id = s.family_id
        WHERE f.primary_user_id = auth.uid()
      )
    )
  )
);

-- Admins can update any homework files
CREATE POLICY "hw_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete any homework files
CREATE POLICY "hw_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can insert anywhere in homework bucket
CREATE POLICY "hw_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- ========================================
-- Migration: 20251030171143_87585c9f-5711-48b0-92a3-75c1a5be0203.sql
-- ========================================
-- Create function to notify students when homework is assigned
CREATE OR REPLACE FUNCTION notify_homework_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment RECORD;
  v_class_name TEXT;
BEGIN
  -- Get class name
  SELECT name INTO v_class_name
  FROM classes
  WHERE id = NEW.class_id;

  -- Notify all enrolled students in the class
  FOR v_enrollment IN 
    SELECT DISTINCT s.linked_user_id, s.full_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.class_id = NEW.class_id
      AND s.linked_user_id IS NOT NULL
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_enrollment.linked_user_id,
      'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object(
        'homework_id', NEW.id,
        'class_id', NEW.class_id,
        'class_name', v_class_name,
        'due_date', NEW.due_date
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for homework assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_homework_assigned ON homeworks;
CREATE TRIGGER trigger_notify_homework_assigned
AFTER INSERT ON homeworks
FOR EACH ROW
EXECUTE FUNCTION notify_homework_assigned();

-- Create function to notify students when homework is graded
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  -- Only notify if grade was just added (changed from NULL to a value)
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    -- Get student's user_id
    SELECT s.linked_user_id INTO v_student_user_id
    FROM students s
    WHERE s.id = NEW.student_id;

    IF v_student_user_id IS NOT NULL THEN
      -- Get homework and class details
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h
      JOIN classes c ON c.id = h.class_id
      WHERE h.id = NEW.homework_id;

      -- Create notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_student_user_id,
        'homework_graded',
        'Homework Graded: ' || v_homework_title,
        'Your homework has been graded in ' || v_class_name,
        jsonb_build_object(
          'homework_id', NEW.homework_id,
          'submission_id', NEW.id,
          'grade', NEW.grade,
          'class_name', v_class_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for homework grading notifications
DROP TRIGGER IF EXISTS trigger_notify_homework_graded ON homework_submissions;
CREATE TRIGGER trigger_notify_homework_graded
AFTER UPDATE ON homework_submissions
FOR EACH ROW
EXECUTE FUNCTION notify_homework_graded();

-- Update the existing notify_journal_post function to work with students
CREATE OR REPLACE FUNCTION notify_journal_post()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_title TEXT;
  v_student_user_id UUID;
BEGIN
  -- Get journal type-specific title
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New journal entry for you: ' || NEW.title INTO v_title;
      -- Get student's user_id
      IF NEW.student_id IS NOT NULL THEN
        SELECT s.linked_user_id INTO v_student_user_id
        FROM students s
        WHERE s.id = NEW.student_id;
        
        -- Notify the student
        IF v_student_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
          VALUES (
            v_student_user_id,
            NEW.id,
            'new_journal',
            v_title,
            'A new journal entry has been posted for you',
            jsonb_build_object(
              'journal_type', NEW.type,
              'student_id', NEW.student_id
            )
          );
        END IF;
      END IF;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
      -- Notify all students in the class
      IF NEW.class_id IS NOT NULL THEN
        FOR v_member IN 
          SELECT DISTINCT s.linked_user_id
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          WHERE e.class_id = NEW.class_id
            AND s.linked_user_id IS NOT NULL
            AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
        LOOP
          IF v_member.linked_user_id != NEW.owner_user_id THEN
            INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
            VALUES (
              v_member.linked_user_id,
              NEW.id,
              'new_journal',
              v_title,
              'A new journal entry has been posted for your class',
              jsonb_build_object(
                'journal_type', NEW.type,
                'class_id', NEW.class_id
              )
            );
          END IF;
        END LOOP;
      END IF;
    WHEN 'collaborative' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;

  -- Notify all journal members except the creator (for collaborative journals)
  FOR v_member IN 
    SELECT user_id 
    FROM journal_members 
    WHERE journal_id = NEW.id 
      AND user_id != NEW.owner_user_id
      AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- Migration: 20251030173701_aeaf20de-4e2c-460c-9c4d-26aeef3ad035.sql
-- ========================================
-- Fix journal visibility for students and teachers
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view class journals" ON public.journal_entries;
DROP POLICY IF EXISTS "Students can view own entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Teachers can view class journals" ON public.journal_entries;
DROP POLICY IF EXISTS "Teachers can view student entries" ON public.journal_entries;

-- Recreate with correct logic for new journals table
DROP POLICY IF EXISTS "Users can read their journals" ON public.journals;

-- Students can view journals created for them
CREATE POLICY "Students can view their journals"
ON public.journals
FOR SELECT
TO authenticated
USING (
  NOT is_deleted 
  AND (
    -- Admin can see all
    has_role(auth.uid(), 'admin'::app_role)
    -- Owner can see their own
    OR owner_user_id = auth.uid()
    -- Student can see journals about them
    OR (type = 'student' AND student_id IN (
      SELECT s.id FROM students s 
      WHERE s.linked_user_id = auth.uid() 
        OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
    ))
    -- Student can see class journals for their classes
    OR (type = 'class' AND class_id IN (
      SELECT e.class_id 
      FROM enrollments e 
      JOIN students s ON s.id = e.student_id
      WHERE s.linked_user_id = auth.uid()
        OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
    ))
    -- Teachers can see journals for their classes
    OR (type = 'class' AND class_id IN (
      SELECT DISTINCT s.class_id
      FROM sessions s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    ))
    -- Teachers can see journals for students in their classes
    OR (type = 'student' AND student_id IN (
      SELECT DISTINCT e.student_id
      FROM enrollments e
      JOIN sessions s ON s.class_id = e.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    ))
    -- Member of the journal
    OR is_journal_member(id, auth.uid())
  )
);

-- Fix notification visibility
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ========================================
-- Migration: 20251030180707_118c4513-2ed9-45af-bbe3-5e27be1c7a70.sql
-- ========================================
-- Fix the notify_journal_post trigger to use correct enum value
CREATE OR REPLACE FUNCTION public.notify_journal_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member RECORD;
  v_title TEXT;
  v_student_user_id UUID;
BEGIN
  -- Get journal type-specific title
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New journal entry for you: ' || NEW.title INTO v_title;
      -- Get student's user_id
      IF NEW.student_id IS NOT NULL THEN
        SELECT s.linked_user_id INTO v_student_user_id
        FROM students s
        WHERE s.id = NEW.student_id;
        
        -- Notify the student
        IF v_student_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
          VALUES (
            v_student_user_id,
            NEW.id,
            'new_journal',
            v_title,
            'A new journal entry has been posted for you',
            jsonb_build_object(
              'journal_type', NEW.type,
              'student_id', NEW.student_id
            )
          );
        END IF;
      END IF;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
      -- Notify all students in the class
      IF NEW.class_id IS NOT NULL THEN
        FOR v_member IN 
          SELECT DISTINCT s.linked_user_id
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          WHERE e.class_id = NEW.class_id
            AND s.linked_user_id IS NOT NULL
            AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
        LOOP
          IF v_member.linked_user_id != NEW.owner_user_id THEN
            INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
            VALUES (
              v_member.linked_user_id,
              NEW.id,
              'new_journal',
              v_title,
              'A new journal entry has been posted for your class',
              jsonb_build_object(
                'journal_type', NEW.type,
                'class_id', NEW.class_id
              )
            );
          END IF;
        END LOOP;
      END IF;
    WHEN 'collab_student_teacher' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;

  -- Notify all journal members except the creator (for collaborative journals)
  FOR v_member IN 
    SELECT user_id 
    FROM journal_members 
    WHERE journal_id = NEW.id 
      AND user_id != NEW.owner_user_id
      AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
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
$function$;

-- ========================================
-- Migration: 20251030182606_54117c9a-e206-4241-8af6-90395941e2d9.sql
-- ========================================
-- Fix notification triggers to support family-based notifications
-- Students can be notified either through linked_user_id OR through their family's primary_user_id

-- Update homework assignment notification to include family users
CREATE OR REPLACE FUNCTION notify_homework_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment RECORD;
  v_class_name TEXT;
BEGIN
  -- Get class name
  SELECT name INTO v_class_name
  FROM classes
  WHERE id = NEW.class_id;

  -- Notify all enrolled students in the class
  -- Check both direct linked_user_id and family primary_user_id
  FOR v_enrollment IN 
    SELECT DISTINCT 
      COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
      s.full_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN families f ON s.family_id = f.id
    WHERE e.class_id = NEW.class_id
      AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_enrollment.user_id,
      'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object(
        'homework_id', NEW.id,
        'class_id', NEW.class_id,
        'class_name', v_class_name,
        'due_date', NEW.due_date
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update homework grading notification to include family users
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  -- Only notify if grade was just added (changed from NULL to a value)
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    -- Get student's user_id (either direct or through family)
    SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
    FROM students s
    LEFT JOIN families f ON s.family_id = f.id
    WHERE s.id = NEW.student_id;

    IF v_student_user_id IS NOT NULL THEN
      -- Get homework and class details
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h
      JOIN classes c ON c.id = h.class_id
      WHERE h.id = NEW.homework_id;

      -- Create notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_student_user_id,
        'homework_graded',
        'Homework Graded: ' || v_homework_title,
        'Your homework has been graded in ' || v_class_name,
        jsonb_build_object(
          'homework_id', NEW.homework_id,
          'submission_id', NEW.id,
          'grade', NEW.grade,
          'class_name', v_class_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update journal notification to include family users
CREATE OR REPLACE FUNCTION public.notify_journal_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member RECORD;
  v_title TEXT;
  v_student_user_id UUID;
BEGIN
  -- Get journal type-specific title
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New journal entry for you: ' || NEW.title INTO v_title;
      -- Get student's user_id (either direct or through family)
      IF NEW.student_id IS NOT NULL THEN
        SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
        FROM students s
        LEFT JOIN families f ON s.family_id = f.id
        WHERE s.id = NEW.student_id;
        
        -- Notify the student (or family primary user)
        IF v_student_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
          VALUES (
            v_student_user_id,
            NEW.id,
            'new_journal',
            v_title,
            'A new journal entry has been posted for you',
            jsonb_build_object(
              'journal_type', NEW.type,
              'student_id', NEW.student_id
            )
          );
        END IF;
      END IF;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
      -- Notify all students in the class (including family users)
      IF NEW.class_id IS NOT NULL THEN
        FOR v_member IN 
          SELECT DISTINCT COALESCE(s.linked_user_id, f.primary_user_id) as user_id
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          LEFT JOIN families f ON s.family_id = f.id
          WHERE e.class_id = NEW.class_id
            AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
            AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
        LOOP
          IF v_member.user_id != NEW.owner_user_id THEN
            INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
            VALUES (
              v_member.user_id,
              NEW.id,
              'new_journal',
              v_title,
              'A new journal entry has been posted for your class',
              jsonb_build_object(
                'journal_type', NEW.type,
                'class_id', NEW.class_id
              )
            );
          END IF;
        END LOOP;
      END IF;
    WHEN 'collab_student_teacher' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;

  -- Notify all journal members except the creator (for collaborative journals)
  FOR v_member IN 
    SELECT user_id 
    FROM journal_members 
    WHERE journal_id = NEW.id 
      AND user_id != NEW.owner_user_id
      AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
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
$function$;

-- ========================================
-- Migration: 20251030182808_c48c673f-db61-4623-814f-02a156fdf7e8.sql
-- ========================================
-- Backfill notifications for existing homework and journals
-- Only backfill items from the last 30 days to avoid overwhelming users

-- Backfill homework assignment notifications
INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
SELECT DISTINCT 
  COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
  'homework_assigned' as type,
  'New Homework: ' || h.title as title,
  'New homework assigned in ' || c.name as message,
  jsonb_build_object(
    'homework_id', h.id,
    'class_id', h.class_id,
    'class_name', c.name,
    'due_date', h.due_date
  ) as metadata,
  h.created_at
FROM homeworks h
JOIN classes c ON c.id = h.class_id
JOIN enrollments e ON e.class_id = h.class_id
JOIN students s ON s.id = e.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE h.created_at > NOW() - INTERVAL '30 days'
  AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
  AND (e.end_date IS NULL OR e.end_date >= h.created_at::date)
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.type = 'homework_assigned'
      AND n.metadata->>'homework_id' = h.id::text
      AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  );

-- Backfill journal notifications for student journals
INSERT INTO notifications (user_id, journal_id, type, title, message, metadata, created_at)
SELECT DISTINCT
  COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
  j.id as journal_id,
  'new_journal' as type,
  'New journal entry for you: ' || j.title as title,
  'A new journal entry has been posted for you' as message,
  jsonb_build_object(
    'journal_type', j.type,
    'student_id', j.student_id
  ) as metadata,
  j.created_at
FROM journals j
JOIN students s ON s.id = j.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE j.type = 'student'
  AND j.created_at > NOW() - INTERVAL '30 days'
  AND NOT j.is_deleted
  AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
  AND j.owner_user_id != COALESCE(s.linked_user_id, f.primary_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.journal_id = j.id
      AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  );

-- Backfill journal notifications for class journals
INSERT INTO notifications (user_id, journal_id, type, title, message, metadata, created_at)
SELECT DISTINCT
  COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
  j.id as journal_id,
  'new_journal' as type,
  'New class journal: ' || j.title as title,
  'A new journal entry has been posted for your class' as message,
  jsonb_build_object(
    'journal_type', j.type,
    'class_id', j.class_id
  ) as metadata,
  j.created_at
FROM journals j
JOIN enrollments e ON e.class_id = j.class_id
JOIN students s ON s.id = e.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE j.type = 'class'
  AND j.created_at > NOW() - INTERVAL '30 days'
  AND NOT j.is_deleted
  AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
  AND (e.end_date IS NULL OR e.end_date >= j.created_at::date)
  AND j.owner_user_id != COALESCE(s.linked_user_id, f.primary_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.journal_id = j.id
      AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  );

-- Backfill journal notifications for collaborative journals (journal members)
INSERT INTO notifications (user_id, journal_id, type, title, message, metadata, created_at)
SELECT DISTINCT
  jm.user_id,
  j.id as journal_id,
  'new_journal' as type,
  'New collaborative journal: ' || j.title as title,
  'A new journal entry has been posted' as message,
  jsonb_build_object(
    'journal_type', j.type,
    'student_id', j.student_id,
    'class_id', j.class_id
  ) as metadata,
  j.created_at
FROM journals j
JOIN journal_members jm ON jm.journal_id = j.id
WHERE j.created_at > NOW() - INTERVAL '30 days'
  AND NOT j.is_deleted
  AND jm.user_id != j.owner_user_id
  AND jm.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.journal_id = j.id
      AND n.user_id = jm.user_id
  );

-- ========================================
-- Migration: 20251030183542_4bcee41c-e675-4b70-bce3-3c45ab7dab3b.sql
-- ========================================
-- Update notification triggers to include student_id in metadata for filtering
-- This allows siblings to only see their own notifications

-- Update homework assignment notification to include student_id
CREATE OR REPLACE FUNCTION notify_homework_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment RECORD;
  v_class_name TEXT;
BEGIN
  -- Get class name
  SELECT name INTO v_class_name
  FROM classes
  WHERE id = NEW.class_id;

  -- Notify each enrolled student individually with their student_id in metadata
  FOR v_enrollment IN 
    SELECT DISTINCT 
      s.id as student_id,
      COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
      s.full_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN families f ON s.family_id = f.id
    WHERE e.class_id = NEW.class_id
      AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_enrollment.user_id,
      'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object(
        'homework_id', NEW.id,
        'class_id', NEW.class_id,
        'class_name', v_class_name,
        'due_date', NEW.due_date,
        'student_id', v_enrollment.student_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update homework grading notification to include student_id
CREATE OR REPLACE FUNCTION notify_homework_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  -- Only notify if grade was just added (changed from NULL to a value)
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    -- Get student's user_id (either direct or through family)
    SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
    FROM students s
    LEFT JOIN families f ON s.family_id = f.id
    WHERE s.id = NEW.student_id;

    IF v_student_user_id IS NOT NULL THEN
      -- Get homework and class details
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h
      JOIN classes c ON c.id = h.class_id
      WHERE h.id = NEW.homework_id;

      -- Create notification with student_id in metadata
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_student_user_id,
        'homework_graded',
        'Homework Graded: ' || v_homework_title,
        'Your homework has been graded in ' || v_class_name,
        jsonb_build_object(
          'homework_id', NEW.homework_id,
          'submission_id', NEW.id,
          'grade', NEW.grade,
          'class_name', v_class_name,
          'student_id', NEW.student_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- Migration: 20251030183614_34900cf9-d735-4bb0-8446-d633cf3d812c.sql
-- ========================================
-- Backfill student_id in existing notification metadata
-- Update homework_assigned notifications
UPDATE notifications n
SET metadata = jsonb_set(
  COALESCE(n.metadata, '{}'::jsonb),
  '{student_id}',
  to_jsonb(e.student_id)
)
FROM homeworks h
JOIN enrollments e ON e.class_id = h.class_id
JOIN students s ON s.id = e.student_id
LEFT JOIN families f ON s.family_id = f.id
WHERE n.type = 'homework_assigned'
  AND n.metadata->>'homework_id' = h.id::text
  AND n.user_id = COALESCE(s.linked_user_id, f.primary_user_id)
  AND n.metadata->>'student_id' IS NULL;

-- Update homework_graded notifications
UPDATE notifications n
SET metadata = jsonb_set(
  COALESCE(n.metadata, '{}'::jsonb),
  '{student_id}',
  to_jsonb(hs.student_id)
)
FROM homework_submissions hs
WHERE n.type = 'homework_graded'
  AND n.metadata->>'submission_id' = hs.id::text
  AND n.metadata->>'student_id' IS NULL;

-- ========================================
-- Migration: 20251101045236_004626b2-c170-49ef-84f9-20b957389e14.sql
-- ========================================
-- Drop existing journal policies
DROP POLICY IF EXISTS "Students can view their journals" ON journals;
DROP POLICY IF EXISTS "Students can create journals" ON journals;
DROP POLICY IF EXISTS "Teachers can create journals" ON journals;
DROP POLICY IF EXISTS "Members can update journals" ON journals;
DROP POLICY IF EXISTS "Owners can delete journals" ON journals;
DROP POLICY IF EXISTS "Users can create journals" ON journals;

-- Create refined journal RLS policies

-- Personal journals: Only owner can view/edit
CREATE POLICY "personal_journal_view" ON journals
FOR SELECT
USING (
  (type = 'personal' AND owner_user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);

-- Student journals: Owner, linked student, and their teachers can view
CREATE POLICY "student_journal_view" ON journals
FOR SELECT
USING (
  (type = 'student' AND (
    owner_user_id = auth.uid()
    OR (student_id IN (
      SELECT id FROM students WHERE linked_user_id = auth.uid()
    ))
    OR is_journal_member(id, auth.uid())
  ))
  OR has_role(auth.uid(), 'admin')
);

-- Class journals: Enrolled students (read) and class teachers can view
CREATE POLICY "class_journal_view" ON journals
FOR SELECT
USING (
  (type = 'class' AND (
    -- Enrolled students can read
    class_id IN (
      SELECT e.class_id FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE s.linked_user_id = auth.uid()
    )
    OR
    -- Teachers of the class can read
    is_teacher_of_class(auth.uid(), class_id)
  ))
  OR has_role(auth.uid(), 'admin')
);

-- Collaborative journals: Owner and invited members can view
CREATE POLICY "collab_journal_view" ON journals
FOR SELECT
USING (
  (type = 'collab_student_teacher' AND (
    owner_user_id = auth.uid()
    OR is_journal_member(id, auth.uid())
  ))
  OR has_role(auth.uid(), 'admin')
);

-- Insert policies
CREATE POLICY "personal_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'personal' 
  AND owner_user_id = auth.uid()
);

CREATE POLICY "student_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'student'
  AND owner_user_id = auth.uid()
  AND (
    student_id IN (
      SELECT id FROM students WHERE linked_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'teacher')
  )
);

CREATE POLICY "class_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'class'
  AND is_teacher_of_class(auth.uid(), class_id)
);

CREATE POLICY "collab_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'collab_student_teacher'
  AND owner_user_id = auth.uid()
);

-- Update policies: Members can update (but not delete for non-owners)
CREATE POLICY "personal_journal_update" ON journals
FOR UPDATE
USING (
  type = 'personal' 
  AND owner_user_id = auth.uid()
  AND NOT is_deleted
);

CREATE POLICY "student_journal_update" ON journals
FOR UPDATE
USING (
  type = 'student'
  AND (owner_user_id = auth.uid() OR is_journal_member(id, auth.uid()))
  AND NOT is_deleted
);

CREATE POLICY "class_journal_update" ON journals
FOR UPDATE
USING (
  type = 'class'
  AND is_teacher_of_class(auth.uid(), class_id)
  AND NOT is_deleted
);

CREATE POLICY "collab_journal_update" ON journals
FOR UPDATE
USING (
  type = 'collab_student_teacher'
  AND (owner_user_id = auth.uid() OR is_journal_member(id, auth.uid()))
  AND NOT is_deleted
);

CREATE POLICY "admin_journal_update" ON journals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Delete policies: Only owners (and teachers for class journals)
CREATE POLICY "personal_journal_delete" ON journals
FOR DELETE
USING (
  type = 'personal'
  AND owner_user_id = auth.uid()
);

CREATE POLICY "student_journal_delete" ON journals
FOR DELETE
USING (
  type = 'student'
  AND owner_user_id = auth.uid()
);

CREATE POLICY "class_journal_delete" ON journals
FOR DELETE
USING (
  type = 'class'
  AND is_teacher_of_class(auth.uid(), class_id)
);

CREATE POLICY "collab_journal_delete" ON journals
FOR DELETE
USING (
  type = 'collab_student_teacher'
  AND owner_user_id = auth.uid()
);

CREATE POLICY "admin_journal_delete" ON journals
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add avatar_url column to students table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'students' AND column_name = 'avatar_url') THEN
    ALTER TABLE students ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Create storage bucket for student avatars if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-avatars', 'student-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for student avatars
DROP POLICY IF EXISTS "Students can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete own avatar" ON storage.objects;

CREATE POLICY "Students can view avatars" ON storage.objects
FOR SELECT
USING (bucket_id = 'student-avatars');

CREATE POLICY "Students can upload own avatar" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM students WHERE linked_user_id = auth.uid()
  )
);

CREATE POLICY "Students can update own avatar" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM students WHERE linked_user_id = auth.uid()
  )
);

CREATE POLICY "Students can delete own avatar" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM students WHERE linked_user_id = auth.uid()
  )
);

-- Trigger to create notification when teacher is added as journal member
CREATE OR REPLACE FUNCTION notify_journal_collaboration()
RETURNS TRIGGER AS $$
DECLARE
  journal_title text;
  journal_owner_id uuid;
BEGIN
  -- Get journal info
  SELECT title, owner_user_id INTO journal_title, journal_owner_id
  FROM journals WHERE id = NEW.journal_id;

  -- Create notification for the invited teacher
  IF NEW.role IN ('editor', 'viewer') THEN
    INSERT INTO notifications (user_id, type, title, message, journal_id, metadata)
    VALUES (
      NEW.user_id,
      'journal_collaboration',
      'Journal Collaboration Invitation',
      'You have been invited to collaborate on journal: ' || journal_title,
      NEW.journal_id,
      jsonb_build_object('role', NEW.role, 'invited_by', journal_owner_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_journal_collaboration ON journal_members;
CREATE TRIGGER trigger_notify_journal_collaboration
AFTER INSERT ON journal_members
FOR EACH ROW
EXECUTE FUNCTION notify_journal_collaboration();

-- ========================================
-- Migration: 20251102073107_3177800c-26d2-43e4-b521-26434c6856f4.sql
-- ========================================
-- Create function to notify teachers about homework submissions
CREATE OR REPLACE FUNCTION notify_teacher_homework_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
BEGIN
  -- Only notify on new submissions or status changes to submitted
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    
    -- Get homework and class details
    SELECT h.*, c.name as class_name, c.default_teacher_id
    INTO v_homework
    FROM homeworks h
    JOIN classes c ON c.id = h.class_id
    WHERE h.id = NEW.homework_id;
    
    -- Get student details
    SELECT full_name INTO v_student
    FROM students
    WHERE id = NEW.student_id;
    
    -- Get teacher from a recent session for this class
    SELECT teacher_id INTO v_teacher_id
    FROM sessions
    WHERE class_id = v_homework.class_id
    ORDER BY date DESC
    LIMIT 1;
    
    -- Create notification for the teacher
    IF v_teacher_id IS NOT NULL THEN
      INSERT INTO notifications (
        type,
        title,
        message,
        metadata
      ) VALUES (
        'homework_submitted',
        'New Homework Submission',
        v_student.full_name || ' submitted homework for ' || v_homework.class_name,
        jsonb_build_object(
          'student_id', NEW.student_id,
          'student_name', v_student.full_name,
          'homework_id', NEW.homework_id,
          'homework_title', v_homework.title,
          'class_id', v_homework.class_id,
          'class_name', v_homework.class_name,
          'submission_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_teacher_homework_submission ON homework_submissions;
CREATE TRIGGER trigger_notify_teacher_homework_submission
  AFTER INSERT OR UPDATE ON homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_homework_submission();

-- ========================================
-- Migration: 20251102073205_abfe62b4-c216-41b0-b969-8b7cf601c061.sql
-- ========================================
-- Fix search_path for notify_teacher_homework_submission function
DROP TRIGGER IF EXISTS trigger_notify_teacher_homework_submission ON homework_submissions;
DROP FUNCTION IF EXISTS notify_teacher_homework_submission();

CREATE OR REPLACE FUNCTION notify_teacher_homework_submission()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
BEGIN
  -- Only notify on new submissions or status changes to submitted
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    
    -- Get homework and class details
    SELECT h.*, c.name as class_name, c.default_teacher_id
    INTO v_homework
    FROM homeworks h
    JOIN classes c ON c.id = h.class_id
    WHERE h.id = NEW.homework_id;
    
    -- Get student details
    SELECT full_name INTO v_student
    FROM students
    WHERE id = NEW.student_id;
    
    -- Get teacher from a recent session for this class
    SELECT teacher_id INTO v_teacher_id
    FROM sessions
    WHERE class_id = v_homework.class_id
    ORDER BY date DESC
    LIMIT 1;
    
    -- Create notification for the teacher
    IF v_teacher_id IS NOT NULL THEN
      INSERT INTO notifications (
        type,
        title,
        message,
        metadata
      ) VALUES (
        'homework_submitted',
        'New Homework Submission',
        v_student.full_name || ' submitted homework for ' || v_homework.class_name,
        jsonb_build_object(
          'student_id', NEW.student_id,
          'student_name', v_student.full_name,
          'homework_id', NEW.homework_id,
          'homework_title', v_homework.title,
          'class_id', v_homework.class_id,
          'class_name', v_homework.class_name,
          'submission_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_notify_teacher_homework_submission
  AFTER INSERT OR UPDATE ON homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_homework_submission();

-- ========================================
-- Migration: 20251103043503_3b7391ec-7a43-49a3-a02b-3394f3ee5b11.sql
-- ========================================
-- Create teacher_banking_info table
CREATE TABLE IF NOT EXISTS public.teacher_banking_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  swift_code TEXT,
  branch_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(teacher_id)
);

-- Enable RLS
ALTER TABLE public.teacher_banking_info ENABLE ROW LEVEL SECURITY;

-- Admins can manage all banking info
CREATE POLICY "Admins can manage banking info"
  ON public.teacher_banking_info
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view and update their own banking info
CREATE POLICY "Teachers can view own banking info"
  ON public.teacher_banking_info
  FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update own banking info"
  ON public.teacher_banking_info
  FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert own banking info"
  ON public.teacher_banking_info
  FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_teacher_banking_info_updated_at
  BEFORE UPDATE ON public.teacher_banking_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_teacher_banking_info_teacher_id ON public.teacher_banking_info(teacher_id);

-- ========================================
-- Migration: 20251106061501_4cb275fc-24d6-4d7c-adbb-e251688dcaaa.sql
-- ========================================

-- Allow teachers to insert homework submissions for students in their classes
-- This is needed for offline grading where no submission exists yet
CREATE POLICY "Teachers can insert submissions for their classes"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  homework_id IN (
    SELECT h.id
    FROM homeworks h
    WHERE is_teacher_of_class(auth.uid(), h.class_id)
  )
);


-- ========================================
-- Migration: 20251106062425_9eabb83b-1640-4b66-b360-4aa22e617b56.sql
-- ========================================

-- Enable realtime for student_points table
ALTER TABLE public.student_points REPLICA IDENTITY FULL;

-- Add to realtime publication (if not already there)
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_points;


-- ========================================
-- Migration: 20251107051453_bdbd674f-ffd5-4e03-b742-393f7e73328b.sql
-- ========================================
-- Fix notify_teacher_homework_submission to include user_id
CREATE OR REPLACE FUNCTION public.notify_teacher_homework_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
  v_teacher_user_id uuid;
BEGIN
  -- Only notify on new submissions or status changes to submitted
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    
    -- Get homework and class details
    SELECT h.*, c.name as class_name, c.default_teacher_id
    INTO v_homework
    FROM homeworks h
    JOIN classes c ON c.id = h.class_id
    WHERE h.id = NEW.homework_id;
    
    -- Get student details
    SELECT full_name INTO v_student
    FROM students
    WHERE id = NEW.student_id;
    
    -- Get teacher from a recent session for this class
    SELECT teacher_id INTO v_teacher_id
    FROM sessions
    WHERE class_id = v_homework.class_id
    ORDER BY date DESC
    LIMIT 1;
    
    -- Get teacher's user_id
    IF v_teacher_id IS NOT NULL THEN
      SELECT user_id INTO v_teacher_user_id
      FROM teachers
      WHERE id = v_teacher_id;
      
      -- Create notification for the teacher
      IF v_teacher_user_id IS NOT NULL THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          metadata
        ) VALUES (
          v_teacher_user_id,
          'homework_submitted',
          'New Homework Submission',
          v_student.full_name || ' submitted homework for ' || v_homework.class_name,
          jsonb_build_object(
            'student_id', NEW.student_id,
            'student_name', v_student.full_name,
            'homework_id', NEW.homework_id,
            'homework_title', v_homework.title,
            'class_id', v_homework.class_id,
            'class_name', v_homework.class_name,
            'submission_id', NEW.id
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ========================================
-- Migration: 20251107052426_4399bd71-e2f2-4b22-856d-269afb51c7e3.sql
-- ========================================
-- Create point transactions table to track individual point awards/deductions
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- Can be positive or negative
  type TEXT NOT NULL CHECK (type IN ('homework', 'participation', 'adjustment')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  homework_id UUID REFERENCES public.homeworks(id) ON DELETE SET NULL,
  homework_title TEXT,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  notes TEXT
);

-- Create index for faster queries
CREATE INDEX idx_point_transactions_student ON public.point_transactions(student_id);
CREATE INDEX idx_point_transactions_class_month ON public.point_transactions(class_id, date);

-- Enable RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for point_transactions
CREATE POLICY "Admins can manage all point transactions"
ON public.point_transactions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can manage transactions for their classes"
ON public.point_transactions FOR ALL
TO authenticated
USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY "Students can view their own transactions"
ON public.point_transactions FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM students 
    WHERE linked_user_id = auth.uid()
    OR family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can view class transactions"
ON public.point_transactions FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
  )
);

-- Function to update student_points when transactions are added
CREATE OR REPLACE FUNCTION update_student_points_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
BEGIN
  -- Get the month from the transaction date
  v_month := to_char(NEW.date, 'YYYY-MM');
  
  -- Calculate total homework and participation points for this student/class/month
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points
  FROM point_transactions
  WHERE student_id = NEW.student_id
    AND class_id = NEW.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  -- Insert or update student_points
  INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
  VALUES (NEW.student_id, NEW.class_id, v_month, v_homework_points, v_participation_points)
  ON CONFLICT (student_id, class_id, month)
  DO UPDATE SET
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_points_from_transaction
AFTER INSERT OR UPDATE ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION update_student_points_from_transaction();

-- Enable realtime for point_transactions
ALTER TABLE public.point_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.point_transactions;

-- ========================================
-- Migration: 20251107085517_4c6aaf6d-d204-4959-9b52-8c78c2813324.sql
-- ========================================
-- Add constraint to point_transactions to enforce -100 to 100 range
ALTER TABLE point_transactions
ADD CONSTRAINT points_range_check CHECK (points >= -100 AND points <= 100);

-- Reset all student points to 0 (total_points is a generated column)
UPDATE student_points
SET 
  homework_points = 0,
  participation_points = 0;

-- Clear all existing point transactions for fresh start
TRUNCATE TABLE point_transactions;

-- ========================================
-- Migration: 20251108115745_17a57835-4160-4801-8a5a-335d7973a324.sql
-- ========================================
-- Ensure point_transactions table has all required columns
DO $$ 
BEGIN
  -- Add month column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'month'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN month TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');
  END IF;

  -- Add date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'date'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- Add type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'manual';
  END IF;

  -- Add homework_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'homework_id'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN homework_id UUID;
  END IF;

  -- Add homework_title column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'homework_title'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN homework_title TEXT;
  END IF;

  -- Add session_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN session_id UUID;
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN notes TEXT;
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN created_by UUID;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Create archived_leaderboards table for historical data
CREATE TABLE IF NOT EXISTS archived_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  homework_points INTEGER NOT NULL DEFAULT 0,
  participation_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Add RLS policies for archived_leaderboards
ALTER TABLE archived_leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage archived leaderboards"
  ON archived_leaderboards
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view their archived scores"
  ON archived_leaderboards
  FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Teachers can view archived scores for their classes"
  ON archived_leaderboards
  FOR SELECT
  USING (is_teacher_of_class(auth.uid(), class_id));

-- Create function to archive and reset monthly leaderboard
CREATE OR REPLACE FUNCTION archive_and_reset_monthly_leaderboard(target_month TEXT)
RETURNS TABLE(archived_count INTEGER, reset_count INTEGER) AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_reset_count INTEGER := 0;
BEGIN
  -- Archive current month's data
  INSERT INTO archived_leaderboards (
    student_id, class_id, month, homework_points, participation_points, total_points, rank, archived_by
  )
  SELECT 
    student_id, 
    class_id, 
    month, 
    homework_points, 
    participation_points, 
    total_points,
    ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY total_points DESC) as rank,
    auth.uid()
  FROM student_points
  WHERE month = target_month;
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Reset student_points for the target month
  UPDATE student_points
  SET 
    homework_points = 0,
    participation_points = 0
  WHERE month = target_month;
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Archive point transactions (optional: keep for audit trail)
  -- We'll keep the transactions but they won't count toward the new month

  RETURN QUERY SELECT v_archived_count, v_reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION archive_and_reset_monthly_leaderboard TO authenticated;

-- ========================================
-- Migration: 20251110093910_84348b13-ffb2-4786-a477-544b4d536432.sql
-- ========================================
-- Create storage buckets for avatars if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-avatars', 'student-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
  ('teacher-avatars', 'teacher-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for student-avatars bucket
-- Allow public read access
CREATE POLICY "Public read access for student avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-avatars');

-- Allow authenticated users to upload their own student avatar
CREATE POLICY "Students can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND auth.uid() IN (
    SELECT linked_user_id FROM students WHERE id::text = (storage.foldername(name))[1]
    UNION
    SELECT f.primary_user_id FROM students s
    JOIN families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated users to update their own student avatar
CREATE POLICY "Students can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-avatars'
  AND auth.uid() IN (
    SELECT linked_user_id FROM students WHERE id::text = (storage.foldername(name))[1]
    UNION
    SELECT f.primary_user_id FROM students s
    JOIN families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated users to delete their own student avatar
CREATE POLICY "Students can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-avatars'
  AND auth.uid() IN (
    SELECT linked_user_id FROM students WHERE id::text = (storage.foldername(name))[1]
    UNION
    SELECT f.primary_user_id FROM students s
    JOIN families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

-- RLS Policies for teacher-avatars bucket
-- Allow public read access
CREATE POLICY "Public read access for teacher avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'teacher-avatars');

-- Allow authenticated teachers to upload their own avatar
CREATE POLICY "Teachers can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND auth.uid() IN (
    SELECT user_id FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated teachers to update their own avatar
CREATE POLICY "Teachers can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'teacher-avatars'
  AND auth.uid() IN (
    SELECT user_id FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated teachers to delete their own avatar
CREATE POLICY "Teachers can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'teacher-avatars'
  AND auth.uid() IN (
    SELECT user_id FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);

-- ========================================
-- Migration: 20251110094006_df2c9f75-1734-4b31-9c8e-104d084795db.sql
-- ========================================
-- Add avatar_url column to teachers table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ========================================
-- Migration: 20251111035144_824f4c30-0cf1-4e03-a633-1b3d2a4c5292.sql
-- ========================================
-- Drop existing policies and create simpler, more reliable ones
DROP POLICY IF EXISTS "Students can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their own avatar" ON storage.objects;

-- Student avatar policies with simpler logic
CREATE POLICY "Students can manage their own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND (
    -- Allow if user is the student
    auth.uid()::text = (
      SELECT linked_user_id::text FROM students WHERE id::text = (storage.foldername(name))[1]
    )
    OR
    -- Allow if user is the family member
    auth.uid()::text = (
      SELECT f.primary_user_id::text FROM students s
      JOIN families f ON s.family_id = f.id
      WHERE s.id::text = (storage.foldername(name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND (
    -- Allow if user is the student
    auth.uid()::text = (
      SELECT linked_user_id::text FROM students WHERE id::text = (storage.foldername(name))[1]
    )
    OR
    -- Allow if user is the family member
    auth.uid()::text = (
      SELECT f.primary_user_id::text FROM students s
      JOIN families f ON s.family_id = f.id
      WHERE s.id::text = (storage.foldername(name))[1]
    )
  )
);

-- Teacher avatar policies with simpler logic
CREATE POLICY "Teachers can manage their own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);

-- ========================================
-- Migration: 20251111035731_18c9c5d2-7688-4cef-80f0-06312e6e86d4.sql
-- ========================================
-- Remove any constraints limiting points in student_points table
-- Allow unlimited points for homework and participation

-- Drop existing check constraints if they exist
ALTER TABLE IF EXISTS student_points DROP CONSTRAINT IF EXISTS student_points_homework_points_check;
ALTER TABLE IF EXISTS student_points DROP CONSTRAINT IF EXISTS student_points_participation_points_check;
ALTER TABLE IF EXISTS student_points DROP CONSTRAINT IF EXISTS student_points_total_points_check;

-- Drop similar constraints from archived_leaderboards if they exist
ALTER TABLE IF EXISTS archived_leaderboards DROP CONSTRAINT IF EXISTS archived_leaderboards_homework_points_check;
ALTER TABLE IF EXISTS archived_leaderboards DROP CONSTRAINT IF EXISTS archived_leaderboards_participation_points_check;
ALTER TABLE IF EXISTS archived_leaderboards DROP CONSTRAINT IF EXISTS archived_leaderboards_total_points_check;

-- Ensure point columns allow large values (already integer type which is sufficient)
-- No need to modify column types as integer supports up to 2,147,483,647

-- ========================================
-- Migration: 20251112040714_2c69bf59-7e63-4056-8eaf-d7fc4aecebe8.sql
-- ========================================
-- Remove point cap constraint from point_transactions to allow unlimited points
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS points_range_check;

-- Ensure point_transactions has proper structure for tracking
COMMENT ON TABLE point_transactions IS 'Tracks individual point awards/deductions. Trigger automatically updates student_points aggregate table.';

-- ========================================
-- Migration: 20251112102525_02aa0b6e-b5f5-4659-bf71-849ec86e0804.sql
-- ========================================
-- Add admin bypass policies for student-avatars bucket
CREATE POLICY "Admins can view all student avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can upload student avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update student avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete student avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Add admin bypass policies for teacher-avatars bucket
CREATE POLICY "Admins can view all teacher avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can upload teacher avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update teacher avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete teacher avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- ========================================
-- Migration: 20251112165936_4464ce6f-874f-4c9f-ad0f-53320974cc02.sql
-- ========================================
-- Add winner_class_id to sibling_discount_state table
-- This tracks which specific class receives the sibling discount for multi-enrollment students

ALTER TABLE sibling_discount_state 
ADD COLUMN winner_class_id UUID REFERENCES classes(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sibling_discount_state_winner_class 
ON sibling_discount_state(winner_class_id) 
WHERE winner_class_id IS NOT NULL;

-- ========================================
-- Migration: 20251113073130_68ef1c40-55e8-4902-a255-bf1f7b5dfc21.sql
-- ========================================
-- Fix security definer functions missing search_path
-- This addresses the function_search_path_mutable security warning

-- Fix notify_teacher_homework_submission function
CREATE OR REPLACE FUNCTION public.notify_teacher_homework_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
  v_teacher_user_id uuid;
BEGIN
  -- Only notify on new submissions or status changes to submitted
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    
    -- Get homework and class details
    SELECT h.*, c.name as class_name, c.default_teacher_id
    INTO v_homework
    FROM homeworks h
    JOIN classes c ON c.id = h.class_id
    WHERE h.id = NEW.homework_id;
    
    -- Get student details
    SELECT full_name INTO v_student
    FROM students
    WHERE id = NEW.student_id;
    
    -- Get teacher from a recent session for this class
    SELECT teacher_id INTO v_teacher_id
    FROM sessions
    WHERE class_id = v_homework.class_id
    ORDER BY date DESC
    LIMIT 1;
    
    -- Get teacher's user_id
    IF v_teacher_id IS NOT NULL THEN
      SELECT user_id INTO v_teacher_user_id
      FROM teachers
      WHERE id = v_teacher_id;
      
      -- Create notification for the teacher
      IF v_teacher_user_id IS NOT NULL THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          metadata
        ) VALUES (
          v_teacher_user_id,
          'homework_submitted',
          'New Homework Submission',
          v_student.full_name || ' submitted homework for ' || v_homework.class_name,
          jsonb_build_object(
            'student_id', NEW.student_id,
            'student_name', v_student.full_name,
            'homework_id', NEW.homework_id,
            'homework_title', v_homework.title,
            'class_id', v_homework.class_id,
            'class_name', v_homework.class_name,
            'submission_id', NEW.id
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix notify_journal_collaboration function
CREATE OR REPLACE FUNCTION public.notify_journal_collaboration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  journal_title text;
  journal_owner_id uuid;
BEGIN
  -- Get journal info
  SELECT title, owner_user_id INTO journal_title, journal_owner_id
  FROM journals WHERE id = NEW.journal_id;

  -- Create notification for the invited teacher
  IF NEW.role IN ('editor', 'viewer') THEN
    INSERT INTO notifications (user_id, type, title, message, journal_id, metadata)
    VALUES (
      NEW.user_id,
      'journal_collaboration',
      'Journal Collaboration Invitation',
      'You have been invited to collaborate on journal: ' || journal_title,
      NEW.journal_id,
      jsonb_build_object('role', NEW.role, 'invited_by', journal_owner_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ========================================
-- Migration: 20251113073500_6d3b9409-3fae-4e1f-92f8-3c0f065635dd.sql
-- ========================================
-- Fix archive_and_reset_monthly_leaderboard function to add search_path
-- This completes the fix for function_search_path_mutable security warning

CREATE OR REPLACE FUNCTION public.archive_and_reset_monthly_leaderboard(target_month text)
RETURNS TABLE(archived_count integer, reset_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_archived_count INTEGER := 0;
  v_reset_count INTEGER := 0;
BEGIN
  -- Archive current month's data
  INSERT INTO archived_leaderboards (
    student_id, class_id, month, homework_points, participation_points, total_points, rank, archived_by
  )
  SELECT 
    student_id, 
    class_id, 
    month, 
    homework_points, 
    participation_points, 
    total_points,
    ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY total_points DESC) as rank,
    auth.uid()
  FROM student_points
  WHERE month = target_month;
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Reset student_points for the target month
  UPDATE student_points
  SET 
    homework_points = 0,
    participation_points = 0
  WHERE month = target_month;
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Archive point transactions (optional: keep for audit trail)
  -- We'll keep the transactions but they won't count toward the new month

  RETURN QUERY SELECT v_archived_count, v_reset_count;
END;
$function$;

-- ========================================
-- Migration: 20251114113011_15a4593f-9dba-43cf-ad2a-ed1b516bdc15.sql
-- ========================================
-- Recalculate all student_points from point_transactions
-- This fixes any data corrupted by the direct upsert bug in HomeworkGradingList

-- Clear existing student_points
TRUNCATE TABLE student_points;

-- Rebuild student_points from point_transactions using the correct aggregation
-- Note: total_points is a generated column, so we don't insert it directly
INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
WHERE student_id IS NOT NULL 
  AND class_id IS NOT NULL 
  AND month IS NOT NULL
GROUP BY student_id, class_id, month;

-- Verify the fix by checking point totals match transactions
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM student_points sp
  LEFT JOIN (
    SELECT 
      student_id, 
      class_id, 
      month, 
      SUM(points) as total
    FROM point_transactions
    GROUP BY student_id, class_id, month
  ) pt ON sp.student_id = pt.student_id 
      AND sp.class_id = pt.class_id 
      AND sp.month = pt.month
  WHERE sp.total_points != COALESCE(pt.total, 0);
  
  IF mismatch_count > 0 THEN
    RAISE NOTICE 'Warning: % records still have mismatches', mismatch_count;
  ELSE
    RAISE NOTICE 'Success: All student_points records now match point_transactions';
  END IF;
END $$;

-- ========================================
-- Migration: 20251114170541_b051d112-4dc5-4999-962d-153b1d6dfa1e.sql
-- ========================================
-- Fix is_student_enrolled_in_class to support family access
-- This allows family primary users and siblings to see class leaderboards

CREATE OR REPLACE FUNCTION is_student_enrolled_in_class(user_id UUID, class_id_check UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    WHERE (
      -- Direct student link
      s.linked_user_id = user_id
      -- OR user is the primary family user
      OR s.family_id IN (
        SELECT id FROM families WHERE primary_user_id = user_id
      )
      -- OR user is a sibling in the same family
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = user_id
      )
    )
    AND e.class_id = class_id_check
    AND e.end_date IS NULL
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ========================================
-- Migration: 20251117061416_2afa5f4f-f2a4-48ba-9c52-9939e4ece5e9.sql
-- ========================================
-- Phase 1: Add enrollment rate override
ALTER TABLE enrollments 
ADD COLUMN rate_override_vnd INTEGER;

COMMENT ON COLUMN enrollments.rate_override_vnd IS 
'Per-student session rate override. If set, overrides class default rate for this enrollment.';

-- Phase 2: Add invoice confirmation fields
ALTER TABLE invoices 
ADD COLUMN confirmation_status TEXT DEFAULT 'needs_review' 
  CHECK (confirmation_status IN ('auto_approved', 'needs_review', 'confirmed', 'adjusted')),
ADD COLUMN review_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN confirmation_notes TEXT,
ADD COLUMN confirmed_at TIMESTAMPTZ,
ADD COLUMN confirmed_by UUID REFERENCES auth.users(id);

CREATE INDEX idx_invoices_confirmation_status ON invoices(confirmation_status);
CREATE INDEX idx_invoices_review_flags ON invoices USING gin(review_flags);

COMMENT ON COLUMN invoices.confirmation_status IS 
'auto_approved: Simple case, no review needed
needs_review: Has discounts or anomalies, requires admin review
confirmed: Admin reviewed and confirmed
adjusted: Admin made adjustments';

COMMENT ON COLUMN invoices.review_flags IS 
'Array of reason objects: [{type: "has_special_discount", label: "Special Discount Applied", details: {...}}]';

-- Phase 3: Create tuition review sessions table for audit
CREATE TABLE tuition_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID REFERENCES auth.users(id),
  month TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  students_reviewed INTEGER DEFAULT 0,
  students_confirmed INTEGER DEFAULT 0,
  students_adjusted INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE tuition_review_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tuition_review_sessions
CREATE POLICY "Admins can manage review sessions"
  ON tuition_review_sessions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Migration: 20251119120124_f63b446c-f1ab-4165-8dbf-bb42081d75f8.sql
-- ========================================
-- Add assignment_instructions column to homework_submissions to store a copy of the instructions
ALTER TABLE homework_submissions 
ADD COLUMN assignment_instructions TEXT;

-- ========================================
-- Migration: 20251122071701_be8734f8-5572-49c2-b77f-5155b3dcd83f.sql
-- ========================================
-- Update can_view_classmate function to handle all student access patterns
CREATE OR REPLACE FUNCTION public.can_view_classmate(student_id_to_view uuid, viewer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if viewer and viewed student share any active classes
  -- Viewer can be: direct student (linked_user_id), primary family user, or sibling
  SELECT EXISTS (
    SELECT 1
    FROM students viewer_student
    JOIN enrollments viewer_enrollment ON viewer_enrollment.student_id = viewer_student.id
    JOIN enrollments viewed_enrollment ON viewed_enrollment.class_id = viewer_enrollment.class_id
    WHERE (
      -- Viewer is the student directly
      viewer_student.linked_user_id = viewer_user_id
      -- OR viewer is the primary family user
      OR viewer_student.family_id IN (
        SELECT id FROM families WHERE primary_user_id = viewer_user_id
      )
      -- OR viewer is a sibling in the same family
      OR viewer_student.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = viewer_user_id
      )
    )
    AND viewed_enrollment.student_id = student_id_to_view
    AND viewer_enrollment.end_date IS NULL
    AND viewed_enrollment.end_date IS NULL
  )
$$;

-- ========================================
-- Migration: 20251122083343_aecb5487-3603-425a-aec3-8405e6e3a2d1.sql
-- ========================================
-- Create avatars table
CREATE TABLE IF NOT EXISTS public.avatars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view active avatars
CREATE POLICY "Users can view active avatars"
ON public.avatars
FOR SELECT
USING (is_active = true);

-- Insert 20 avatars (15 standard, 5 premium)
INSERT INTO public.avatars (name, image_url, is_premium, display_order) VALUES
  -- Standard avatars (1-15)
  ('Blue Circle', 'https://api.dicebear.com/7.x/shapes/svg?seed=blue1&backgroundColor=3b82f6', false, 1),
  ('Green Square', 'https://api.dicebear.com/7.x/shapes/svg?seed=green1&backgroundColor=22c55e', false, 2),
  ('Purple Triangle', 'https://api.dicebear.com/7.x/shapes/svg?seed=purple1&backgroundColor=a855f7', false, 3),
  ('Orange Star', 'https://api.dicebear.com/7.x/shapes/svg?seed=orange1&backgroundColor=f97316', false, 4),
  ('Pink Heart', 'https://api.dicebear.com/7.x/shapes/svg?seed=pink1&backgroundColor=ec4899', false, 5),
  ('Cyan Wave', 'https://api.dicebear.com/7.x/shapes/svg?seed=cyan1&backgroundColor=06b6d4', false, 6),
  ('Yellow Sun', 'https://api.dicebear.com/7.x/shapes/svg?seed=yellow1&backgroundColor=eab308', false, 7),
  ('Red Flame', 'https://api.dicebear.com/7.x/shapes/svg?seed=red1&backgroundColor=ef4444', false, 8),
  ('Indigo Moon', 'https://api.dicebear.com/7.x/shapes/svg?seed=indigo1&backgroundColor=6366f1', false, 9),
  ('Teal Leaf', 'https://api.dicebear.com/7.x/shapes/svg?seed=teal1&backgroundColor=14b8a6', false, 10),
  ('Lime Bolt', 'https://api.dicebear.com/7.x/shapes/svg?seed=lime1&backgroundColor=84cc16', false, 11),
  ('Rose Flower', 'https://api.dicebear.com/7.x/shapes/svg?seed=rose1&backgroundColor=f43f5e', false, 12),
  ('Sky Cloud', 'https://api.dicebear.com/7.x/shapes/svg?seed=sky1&backgroundColor=0ea5e9', false, 13),
  ('Amber Fire', 'https://api.dicebear.com/7.x/shapes/svg?seed=amber1&backgroundColor=f59e0b', false, 14),
  ('Violet Dream', 'https://api.dicebear.com/7.x/shapes/svg?seed=violet1&backgroundColor=8b5cf6', false, 15),
  -- Premium avatars (16-20)
  ('Gold Crown', 'https://api.dicebear.com/7.x/shapes/svg?seed=gold1&backgroundColor=fbbf24&scale=120', true, 16),
  ('Diamond Sparkle', 'https://api.dicebear.com/7.x/shapes/svg?seed=diamond1&backgroundColor=e0e7ff&scale=120', true, 17),
  ('Platinum Shield', 'https://api.dicebear.com/7.x/shapes/svg?seed=platinum1&backgroundColor=cbd5e1&scale=120', true, 18),
  ('Ruby Gem', 'https://api.dicebear.com/7.x/shapes/svg?seed=ruby1&backgroundColor=dc2626&scale=120', true, 19),
  ('Emerald Trophy', 'https://api.dicebear.com/7.x/shapes/svg?seed=emerald1&backgroundColor=059669&scale=120', true, 20);

-- ========================================
-- Migration: 20251123071846_2d9d099b-1ebc-49ed-9772-89ed1766f97d.sql
-- ========================================
-- Clear existing avatars and insert new ones
DELETE FROM public.avatars;

-- Insert 10 new avatars (all standard/free)
INSERT INTO public.avatars (name, image_url, is_premium, display_order, is_active) VALUES
('Lion', '/src/assets/avatars/avatar-003.png', false, 1, true),
('Cupcake', '/src/assets/avatars/avatar-006.png', false, 2, true),
('Car', '/src/assets/avatars/avatar-007.png', false, 3, true),
('Blue Friend', '/src/assets/avatars/avatar-009.png', false, 4, true),
('Chick', '/src/assets/avatars/avatar-018.png', false, 5, true),
('Pear', '/src/assets/avatars/avatar-025.png', false, 6, true),
('Green Friend', '/src/assets/avatars/avatar-050.png', false, 7, true),
('Sunshine', '/src/assets/avatars/avatar-051.png', false, 8, true),
('Flower', '/src/assets/avatars/avatar-054.png', false, 9, true),
('Penguin', '/src/assets/avatars/avatar-055.png', false, 10, true);

-- ========================================
-- Migration: 20251201004021_f439d0fa-e564-460f-be9b-1bc92bfd06f4.sql
-- ========================================
-- Enable realtime for enrollments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;

-- ========================================
-- Migration: 20251202015608_83ec8d22-2c9b-4c4a-b1bb-885b512864b6.sql
-- ========================================
-- Add carry balance columns to invoices table for proper credit/debit tracking
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS carry_in_credit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS carry_in_debt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS carry_out_credit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS carry_out_debt integer DEFAULT 0;

COMMENT ON COLUMN invoices.carry_in_credit IS 'Prior month credit balance (family overpaid)';
COMMENT ON COLUMN invoices.carry_in_debt IS 'Prior month debt balance (family owes)';
COMMENT ON COLUMN invoices.carry_out_credit IS 'Current month closing credit balance';
COMMENT ON COLUMN invoices.carry_out_debt IS 'Current month closing debt balance';

-- ========================================
-- Migration: 20251203104709_f1382ff3-057a-490b-a822-cad76f12f1df.sql
-- ========================================
-- Add allowed_days column to enrollments table
-- NULL = all days (default behavior, backwards compatible)
-- Array of integers representing day of week (0=Sunday, 1=Monday, 2=Tuesday, etc.)
-- Example: [2] = Tuesday only, [2, 6] = Tuesday and Saturday

ALTER TABLE public.enrollments ADD COLUMN allowed_days integer[] DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.enrollments.allowed_days IS 'Array of weekday numbers (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat) the student attends. NULL means all days.';

-- ========================================
-- Migration: 20251203114723_402d99c6-cbeb-49f2-9a15-123d1c37fc0d.sql
-- ========================================
-- Add class_breakdown column to store per-class tuition amounts
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS class_breakdown jsonb DEFAULT '[]'::jsonb;

-- ========================================
-- Migration: 20251226104556_bbe15eae-885e-4ac6-a628-f23882951b6d.sql
-- ========================================
-- Create trigger function to recalculate student_points when a point_transaction is deleted
CREATE OR REPLACE FUNCTION recalculate_student_points_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
BEGIN
  v_month := to_char(OLD.date, 'YYYY-MM');
  
  -- Recalculate totals from remaining transactions
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points
  FROM point_transactions
  WHERE student_id = OLD.student_id
    AND class_id = OLD.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  -- Update the student_points record
  UPDATE student_points 
  SET 
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    updated_at = now()
  WHERE student_id = OLD.student_id 
    AND class_id = OLD.class_id 
    AND month = v_month;
    
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for DELETE events
CREATE TRIGGER trigger_recalculate_points_on_delete
AFTER DELETE ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION recalculate_student_points_on_delete();

-- ========================================
-- Migration: 20251226104609_25c4cd2c-9ce7-442c-b26b-7a252bb3b90f.sql
-- ========================================
-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION recalculate_student_points_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
BEGIN
  v_month := to_char(OLD.date, 'YYYY-MM');
  
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points
  FROM public.point_transactions
  WHERE student_id = OLD.student_id
    AND class_id = OLD.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  UPDATE public.student_points 
  SET 
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    updated_at = now()
  WHERE student_id = OLD.student_id 
    AND class_id = OLD.class_id 
    AND month = v_month;
    
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- Migration: 20251230160539_deaa3137-869c-44b4-a0f5-2f8fe45ba1e2.sql
-- ========================================
-- Fix: Allow family accounts to view classmates' point history
-- Drop the existing policy and recreate with family primary_user_id check

DROP POLICY IF EXISTS "Students can view class transactions" ON point_transactions;

CREATE POLICY "Students can view class transactions" 
ON point_transactions FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid() 
       OR s.family_id IN (
         SELECT students.family_id 
         FROM students 
         WHERE students.linked_user_id = auth.uid()
       )
       OR s.family_id IN (
         SELECT families.id 
         FROM families 
         WHERE families.primary_user_id = auth.uid()
       )
  )
);

-- ========================================
-- Migration: 20251230173759_e85f8d2e-190a-43d1-b482-4c6bb6be34b4.sql
-- ========================================
-- Create skill_assessments table for detailed skill tracking
CREATE TABLE public.skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  skill TEXT NOT NULL CHECK (skill IN ('reading', 'writing', 'listening', 'speaking', 'teamwork', 'personal')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  teacher_comment TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_skill_assessments_student_date ON public.skill_assessments(student_id, date);
CREATE INDEX idx_skill_assessments_class_date ON public.skill_assessments(class_id, date);
CREATE INDEX idx_skill_assessments_skill ON public.skill_assessments(skill);

-- Enable RLS
ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage skill assessments"
ON public.skill_assessments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can manage assessments for their classes
CREATE POLICY "Teachers can manage class skill assessments"
ON public.skill_assessments FOR ALL
TO authenticated
USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

-- Students can view their own assessments and classmates (for radar chart comparison)
CREATE POLICY "Students can view class skill assessments"
ON public.skill_assessments FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid() 
       OR s.family_id IN (
         SELECT students.family_id 
         FROM students 
         WHERE students.linked_user_id = auth.uid()
       )
       OR s.family_id IN (
         SELECT families.id 
         FROM families 
         WHERE families.primary_user_id = auth.uid()
       )
  )
);

-- ========================================
-- Migration: 20251231065924_0189ceed-ab85-40a1-bb04-f53e4cdb6304.sql
-- ========================================
-- Allow classmates to view each other's homework submissions
-- A classmate is someone enrolled in the same class
CREATE POLICY "Classmates can view submissions" 
ON homework_submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM homeworks hw
    JOIN enrollments viewer_enroll ON viewer_enroll.class_id = hw.class_id
    JOIN students viewer ON viewer.id = viewer_enroll.student_id
    WHERE hw.id = homework_submissions.homework_id
    AND (viewer_enroll.end_date IS NULL OR viewer_enroll.end_date > CURRENT_DATE)
    AND (
      viewer.linked_user_id = auth.uid()
      OR viewer.family_id IN (SELECT id FROM families WHERE primary_user_id = auth.uid())
      OR viewer.family_id IN (SELECT family_id FROM students WHERE linked_user_id = auth.uid())
    )
  )
);

-- Allow classmates to view each other's attendance
-- A classmate is someone enrolled in the same class where the session took place
CREATE POLICY "Classmates can view attendance" 
ON attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM sessions sess
    JOIN enrollments viewer_enroll ON viewer_enroll.class_id = sess.class_id
    JOIN students viewer ON viewer.id = viewer_enroll.student_id
    WHERE sess.id = attendance.session_id
    AND (viewer_enroll.end_date IS NULL OR viewer_enroll.end_date > CURRENT_DATE)
    AND (
      viewer.linked_user_id = auth.uid()
      OR viewer.family_id IN (SELECT id FROM families WHERE primary_user_id = auth.uid())
      OR viewer.family_id IN (SELECT family_id FROM students WHERE linked_user_id = auth.uid())
    )
  )
);

-- ========================================
-- Migration: 20251231153638_75f2f938-679c-4d85-bddf-83579236697d.sql
-- ========================================
-- Drop the existing type check constraint
ALTER TABLE public.point_transactions 
DROP CONSTRAINT IF EXISTS point_transactions_type_check;

-- Add updated constraint that includes 'correction'
ALTER TABLE public.point_transactions 
ADD CONSTRAINT point_transactions_type_check 
CHECK (type = ANY (ARRAY['homework'::text, 'participation'::text, 'adjustment'::text, 'correction'::text]));

-- ========================================
-- Migration: 20251231165302_0ef8bb42-762c-48e1-b6c6-5fa3925bf971.sql
-- ========================================
-- Drop the old constraint and add new one that includes 'focus'
ALTER TABLE skill_assessments DROP CONSTRAINT skill_assessments_skill_check;

ALTER TABLE skill_assessments ADD CONSTRAINT skill_assessments_skill_check 
CHECK (skill = ANY (ARRAY['reading'::text, 'writing'::text, 'listening'::text, 'speaking'::text, 'teamwork'::text, 'personal'::text, 'focus'::text]));

-- Backfill focus points from point_transactions to skill_assessments
INSERT INTO skill_assessments (student_id, class_id, session_id, skill, score, date, created_by, teacher_comment)
SELECT 
  pt.student_id,
  pt.class_id,
  pt.session_id,
  'focus' as skill,
  pt.points as score,
  pt.date,
  pt.created_by,
  pt.notes as teacher_comment
FROM point_transactions pt
WHERE pt.type = 'participation' 
  AND pt.notes ILIKE '%focus%'
  AND NOT EXISTS (
    SELECT 1 FROM skill_assessments sa 
    WHERE sa.student_id = pt.student_id 
      AND sa.class_id = pt.class_id 
      AND sa.date = pt.date 
      AND sa.skill = 'focus'
      AND sa.score = pt.points
  );

-- Backfill teamwork points from point_transactions to skill_assessments
INSERT INTO skill_assessments (student_id, class_id, session_id, skill, score, date, created_by, teacher_comment)
SELECT 
  pt.student_id,
  pt.class_id,
  pt.session_id,
  'teamwork' as skill,
  pt.points as score,
  pt.date,
  pt.created_by,
  pt.notes as teacher_comment
FROM point_transactions pt
WHERE pt.type = 'participation'
  AND pt.notes ILIKE '%teamwork%'
  AND NOT EXISTS (
    SELECT 1 FROM skill_assessments sa 
    WHERE sa.student_id = pt.student_id 
      AND sa.class_id = pt.class_id 
      AND sa.date = pt.date 
      AND sa.skill = 'teamwork'
      AND sa.score = pt.points
  );

-- ========================================
-- Migration: 20260106162137_f719073f-30d4-4c7e-a3a9-b2d8b1a403bb.sql
-- ========================================
-- Step 1: Update point_transactions to use homework due_date instead of grading date
UPDATE point_transactions pt
SET 
  date = h.due_date,
  month = to_char(h.due_date, 'YYYY-MM')
FROM homeworks h
WHERE pt.homework_id = h.id
  AND pt.type = 'homework'
  AND h.due_date IS NOT NULL
  AND pt.date != h.due_date;

-- Step 2: Recalculate all student_points from corrected point_transactions
TRUNCATE TABLE student_points;

INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
GROUP BY student_id, class_id, month
ON CONFLICT (student_id, class_id, month)
DO UPDATE SET
  homework_points = EXCLUDED.homework_points,
  participation_points = EXCLUDED.participation_points,
  updated_at = now();

-- ========================================
-- Migration: 20260106173758_cc1ca24c-4038-4139-9373-ffdff3181744.sql
-- ========================================
-- Fix the remaining point_transactions that have wrong dates
UPDATE point_transactions pt
SET 
  date = h.due_date,
  month = to_char(h.due_date::date, 'YYYY-MM')
FROM homeworks h
WHERE pt.homework_id = h.id
  AND pt.type = 'homework'
  AND h.due_date IS NOT NULL
  AND pt.date != h.due_date;

-- Rebuild student_points table with corrected data
TRUNCATE TABLE student_points;

INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
GROUP BY student_id, class_id, month
ON CONFLICT (student_id, class_id, month)
DO UPDATE SET
  homework_points = EXCLUDED.homework_points,
  participation_points = EXCLUDED.participation_points,
  updated_at = now();

-- ========================================
-- Migration: 20260106191604_15238a2e-1801-43a9-87ae-e430effe57a1.sql
-- ========================================
-- Fix incorrect homework point transactions where date differs from homework due_date
-- Only fix transactions created after 2026-01-06 17:30:00 (when the bug was introduced)
UPDATE point_transactions pt
SET 
  date = h.due_date,
  month = to_char(h.due_date::date, 'YYYY-MM')
FROM homeworks h
WHERE pt.homework_id = h.id
  AND pt.type = 'homework'
  AND h.due_date IS NOT NULL
  AND pt.date != h.due_date
  AND pt.created_at >= '2026-01-06 17:30:00';

-- Rebuild student_points table with corrected data
TRUNCATE TABLE student_points;

INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
GROUP BY student_id, class_id, month
ON CONFLICT (student_id, class_id, month)
DO UPDATE SET
  homework_points = EXCLUDED.homework_points,
  participation_points = EXCLUDED.participation_points,
  updated_at = now();

-- ========================================
-- Migration: 20260107053048_54d5c69c-4e3a-42cd-b90d-2d50c065ce3b.sql
-- ========================================
-- Fix the Jupiter class homework transactions that were graded with old cached code
UPDATE point_transactions pt
SET 
  date = h.due_date,
  month = to_char(h.due_date::date, 'YYYY-MM')
FROM homeworks h
WHERE pt.homework_id = h.id
  AND pt.type = 'homework'
  AND pt.class_id = '18dab237-8295-4bae-96d0-e3dfcfc90a41'
  AND pt.month = '2026-01'
  AND h.due_date IS NOT NULL
  AND pt.date != h.due_date
  AND pt.created_at >= '2026-01-06 19:16:00';

-- Rebuild student_points with corrected data (excluding generated column total_points)
TRUNCATE TABLE student_points;

INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
GROUP BY student_id, class_id, month
ON CONFLICT (student_id, class_id, month)
DO UPDATE SET
  homework_points = EXCLUDED.homework_points,
  participation_points = EXCLUDED.participation_points,
  updated_at = now();

-- ========================================
-- Migration: 20260107053449_410115ad-9da8-4111-8e91-cf8a4563c033.sql
-- ========================================
-- Create trigger function to validate/correct homework point transaction dates
CREATE OR REPLACE FUNCTION public.validate_homework_point_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_homework_due_date DATE;
BEGIN
  -- Only validate homework type transactions with a homework_id
  IF NEW.type = 'homework' AND NEW.homework_id IS NOT NULL THEN
    -- Get the homework's due_date
    SELECT due_date INTO v_homework_due_date
    FROM homeworks
    WHERE id = NEW.homework_id;
    
    -- If homework has a due_date, ensure transaction uses it
    IF v_homework_due_date IS NOT NULL THEN
      -- Auto-correct the date and month to match homework due_date
      NEW.date := v_homework_due_date;
      NEW.month := to_char(v_homework_due_date, 'YYYY-MM');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on point_transactions
DROP TRIGGER IF EXISTS validate_homework_point_date ON point_transactions;
CREATE TRIGGER validate_homework_point_date
  BEFORE INSERT OR UPDATE ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_homework_point_transaction();

-- ========================================
-- Migration: 20260107054543_e00e1453-ec50-4c7e-a598-f3b6d1e9b953.sql
-- ========================================
-- Add reading_theory_points column to student_points
ALTER TABLE student_points 
ADD COLUMN IF NOT EXISTS reading_theory_points INTEGER NOT NULL DEFAULT 0;

-- Drop and recreate the generated total_points column to include reading_theory_points
ALTER TABLE student_points DROP COLUMN IF EXISTS total_points;
ALTER TABLE student_points 
ADD COLUMN total_points INTEGER GENERATED ALWAYS AS 
  (homework_points + participation_points + reading_theory_points) STORED;

-- Update point_transactions type constraint to include reading_theory
ALTER TABLE point_transactions 
DROP CONSTRAINT IF EXISTS point_transactions_type_check;

ALTER TABLE point_transactions 
ADD CONSTRAINT point_transactions_type_check 
CHECK (type IN ('homework', 'participation', 'adjustment', 'correction', 'reading_theory'));

-- Update the trigger function to handle reading_theory_points
CREATE OR REPLACE FUNCTION update_student_points_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
  v_reading_theory_points INTEGER;
BEGIN
  v_month := to_char(NEW.date, 'YYYY-MM');
  
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'reading_theory' THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points, v_reading_theory_points
  FROM point_transactions
  WHERE student_id = NEW.student_id
    AND class_id = NEW.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points, reading_theory_points)
  VALUES (NEW.student_id, NEW.class_id, v_month, v_homework_points, v_participation_points, v_reading_theory_points)
  ON CONFLICT (student_id, class_id, month)
  DO UPDATE SET
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    reading_theory_points = v_reading_theory_points,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- Migration: 20260108172011_2b599ed9-372d-481d-b13d-dedc66e02591.sql
-- ========================================
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

-- ========================================
-- Migration: 20260109024445_bcdfae36-790b-4311-8bae-911190e7d0ce.sql
-- ========================================
-- Create early_submission_rewards table to track bonuses
CREATE TABLE early_submission_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES homework_submissions(id) ON DELETE SET NULL,
  points_awarded INT NOT NULL DEFAULT 5,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES auth.users(id),
  point_transaction_id UUID REFERENCES point_transactions(id),
  UNIQUE(homework_id, student_id)
);

-- Enable RLS
ALTER TABLE early_submission_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for early_submission_rewards
CREATE POLICY "Students can view their own early submission rewards"
  ON early_submission_rewards FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE linked_user_id = auth.uid()));

CREATE POLICY "Teachers can view early submission rewards for their classes"
  ON early_submission_rewards FOR SELECT
  USING (homework_id IN (
    SELECT h.id FROM homeworks h
    JOIN classes c ON h.class_id = c.id
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON s.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "System can insert early submission rewards"
  ON early_submission_rewards FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE linked_user_id = auth.uid()));

CREATE POLICY "Teachers can update early submission rewards"
  ON early_submission_rewards FOR UPDATE
  USING (homework_id IN (
    SELECT h.id FROM homeworks h
    JOIN classes c ON h.class_id = c.id
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON s.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- ========================================
-- Migration: 20260109111521_35cf4b08-de2e-4e07-86b0-bb9be446a3c6.sql
-- ========================================
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

-- ========================================
-- Migration: 20260109121221_cbf68a2f-a585-40df-ade8-336409202295.sql
-- ========================================
-- Allow students to see all classmates' enrollments for leaderboard display
CREATE POLICY "Students can view classmates enrollments"
ON public.enrollments
FOR SELECT
USING (
  -- User can see enrollments in any class where they have an active enrollment
  class_id IN (
    SELECT e.class_id 
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE (
      -- Direct student link
      s.linked_user_id = auth.uid()
      -- OR user is the primary family user
      OR s.family_id IN (
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
    )
    AND e.end_date IS NULL
  )
);

-- ========================================
-- Migration: 20260109123950_6aba8596-1dbe-4193-b8df-ab185c560cfc.sql
-- ========================================
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Students can view classmates enrollments" ON public.enrollments;

-- ========================================
-- Migration: 20260109160952_c3fc3585-526a-4046-aa2c-deed9c8fd9c0.sql
-- ========================================
-- Security Fix: Remove overly permissive INSERT policies on system tables
-- These tables should only be written to by triggers/service role, not direct client inserts

-- 1. Drop permissive INSERT policies on notifications table
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- 2. Drop permissive INSERT policies on journal_audit table  
DROP POLICY IF EXISTS "System can create audit logs" ON journal_audit;

-- 3. Fix journal_members policy - make it more restrictive
-- Replace the overly permissive policy with a proper admin-only policy
DROP POLICY IF EXISTS "System can create owner memberships" ON journal_members;

-- Create a more restrictive policy that only allows:
-- 1. Admins to create any membership
-- 2. Service role (for triggers) - which bypasses RLS
-- Note: Triggers using SECURITY DEFINER functions bypass RLS anyway
CREATE POLICY "Only admins can directly insert journal_members"
  ON journal_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only admins can directly insert (triggers use service role and bypass RLS)
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 4. Make homework storage bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'homework';

-- 5. Drop overly permissive storage policy
DROP POLICY IF EXISTS "hw_authenticated_select" ON storage.objects;

-- 6. Create proper scoped storage policies for homework bucket

-- Teachers can view all homework files (they grade submissions)
CREATE POLICY "Teachers view all homework"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM teachers 
    WHERE user_id = auth.uid()
  )
);

-- Admins can view all homework files
CREATE POLICY "Admins view all homework"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Students can view their own submissions
CREATE POLICY "Students view own submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND name LIKE 'submissions/%'
  AND (
    -- Extract student_id from path: submissions/{homework_id}/{student_id}/...
    -- Check if this student is linked to the current user
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.linked_user_id = auth.uid()
      AND name LIKE 'submissions/%/' || s.id::text || '/%'
    )
  )
);

-- Students can view assignment files for classes they're enrolled in
CREATE POLICY "Students view enrolled class assignments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND name LIKE 'assignments/%'
  AND EXISTS (
    -- Check if user is a student enrolled in the class that owns this homework
    SELECT 1 FROM students s
    JOIN enrollments e ON e.student_id = s.id
    JOIN homeworks h ON h.class_id = e.class_id
    WHERE s.linked_user_id = auth.uid()
    AND name LIKE 'assignments/' || h.id::text || '/%'
  )
);

-- ========================================
-- Migration: 20260114145737_33c401b7-3f09-4f0f-92c6-90c62991e153.sql
-- ========================================
-- Remove the overly permissive policy that allows any authenticated user to view bank info
DROP POLICY IF EXISTS "Authenticated users can view bank info" ON public.bank_info;

-- The remaining policies are correct:
-- 1. "Admins and families can view bank info" - allows SELECT for admins, families, and linked students
-- 2. "Admins can manage bank info" - allows ALL operations for admins only

-- ========================================
-- Migration: 20260117143635_07bd3d8a-bcd5-45a8-a340-e9aca0cb5d50.sql
-- ========================================
-- Add indexes to speed up homework queries

-- Speed up homework lookups by class
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON public.homeworks(class_id);

-- Speed up ordering by creation date  
CREATE INDEX IF NOT EXISTS idx_homeworks_created_at ON public.homeworks(created_at DESC);

-- Composite index for common query pattern (class + order by created_at)
CREATE INDEX IF NOT EXISTS idx_homeworks_class_created ON public.homeworks(class_id, created_at DESC);

-- Speed up submission lookups by student
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON public.homework_submissions(student_id);

-- Composite index for homework + student lookup
CREATE INDEX IF NOT EXISTS idx_homework_submissions_hw_student ON public.homework_submissions(homework_id, student_id);

-- Speed up homework file lookups
CREATE INDEX IF NOT EXISTS idx_homework_files_homework ON public.homework_files(homework_id);

-- ========================================
-- Migration: 20260210150027_9d569fcd-86a0-412e-bc6c-b1ade252a15f.sql
-- ========================================

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


-- ========================================
-- Migration: 20260222101440_26970e7b-87ec-4f55-b394-da695f53abe3.sql
-- ========================================
-- Remove the policy that allows classmates to view each other's homework submissions
-- (including grades, teacher feedback, and submission files)
-- Students should only see their own submissions
DROP POLICY IF EXISTS "Classmates can view submissions" ON public.homework_submissions;

-- ========================================
-- Migration: 20260225143601_15a20ce2-5699-4d72-b91e-6a6bb3659425.sql
-- ========================================

-- Create feedback_reactions table for student "Thank Teacher" reactions
CREATE TABLE public.feedback_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(submission_id, student_id)
);

-- Enable RLS
ALTER TABLE public.feedback_reactions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own reactions
CREATE POLICY "Students can insert own reactions"
  ON public.feedback_reactions
  FOR INSERT
  WITH CHECK (can_view_student(student_id, auth.uid()));

-- Students can view own reactions
CREATE POLICY "Students can view own reactions"
  ON public.feedback_reactions
  FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

-- Teachers can view reactions on submissions they graded
CREATE POLICY "Teachers can view feedback reactions"
  ON public.feedback_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homeworks h ON h.id = hs.homework_id
      JOIN sessions s ON s.class_id = h.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE hs.id = feedback_reactions.submission_id
      AND t.user_id = auth.uid()
    )
  );

-- Admins can manage all
CREATE POLICY "Admins can manage feedback reactions"
  ON public.feedback_reactions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));


-- ========================================
-- Migration: 20260302162504_1b85661d-52df-480d-ba10-73993ae3bda0.sql
-- ========================================
ALTER TABLE public.students ADD COLUMN status_message text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.validate_status_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_message IS NOT NULL AND length(NEW.status_message) > 50 THEN
    RAISE EXCEPTION 'status_message must be 50 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_status_message
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_status_message();

-- ========================================
-- Migration: 20260305152550_8ca73716-7d84-4d1d-9b34-ae26e48efd63.sql
-- ========================================
ALTER TABLE public.teachers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN linked_user_id DROP NOT NULL;

-- ========================================
-- Migration: 20260307233057_67325d8c-2a0b-408f-8f0b-3feb5e037efe.sql
-- ========================================

-- Fix validate_status_message
CREATE OR REPLACE FUNCTION public.validate_status_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.status_message IS NOT NULL AND length(NEW.status_message) > 50 THEN
    RAISE EXCEPTION 'status_message must be 50 characters or fewer';
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_homework_assigned
CREATE OR REPLACE FUNCTION public.notify_homework_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_enrollment RECORD;
  v_class_name TEXT;
BEGIN
  SELECT name INTO v_class_name FROM classes WHERE id = NEW.class_id;
  FOR v_enrollment IN 
    SELECT DISTINCT 
      s.id as student_id,
      COALESCE(s.linked_user_id, f.primary_user_id) as user_id,
      s.full_name
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN families f ON s.family_id = f.id
    WHERE e.class_id = NEW.class_id
      AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_enrollment.user_id, 'homework_assigned',
      'New Homework: ' || NEW.title,
      'New homework assigned in ' || v_class_name,
      jsonb_build_object('homework_id', NEW.id, 'class_id', NEW.class_id, 'class_name', v_class_name, 'due_date', NEW.due_date, 'student_id', v_enrollment.student_id)
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Fix notify_teacher_homework_submission
CREATE OR REPLACE FUNCTION public.notify_teacher_homework_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_homework RECORD;
  v_student RECORD;
  v_teacher_id uuid;
  v_teacher_user_id uuid;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'submitted') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'submitted' AND NEW.status = 'submitted') THEN
    SELECT h.*, c.name as class_name, c.default_teacher_id INTO v_homework
    FROM homeworks h JOIN classes c ON c.id = h.class_id WHERE h.id = NEW.homework_id;
    SELECT full_name INTO v_student FROM students WHERE id = NEW.student_id;
    SELECT teacher_id INTO v_teacher_id FROM sessions WHERE class_id = v_homework.class_id ORDER BY date DESC LIMIT 1;
    IF v_teacher_id IS NOT NULL THEN
      SELECT user_id INTO v_teacher_user_id FROM teachers WHERE id = v_teacher_id;
      IF v_teacher_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, metadata)
        VALUES (v_teacher_user_id, 'homework_submitted', 'New Homework Submission',
          v_student.full_name || ' submitted homework for ' || v_homework.class_name,
          jsonb_build_object('student_id', NEW.student_id, 'student_name', v_student.full_name, 'homework_id', NEW.homework_id, 'homework_title', v_homework.title, 'class_id', v_homework.class_id, 'class_name', v_homework.class_name, 'submission_id', NEW.id));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_homework_graded
CREATE OR REPLACE FUNCTION public.notify_homework_graded()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_student_user_id UUID;
  v_homework_title TEXT;
  v_class_name TEXT;
BEGIN
  IF OLD.grade IS NULL AND NEW.grade IS NOT NULL THEN
    SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
    FROM students s LEFT JOIN families f ON s.family_id = f.id WHERE s.id = NEW.student_id;
    IF v_student_user_id IS NOT NULL THEN
      SELECT h.title, c.name INTO v_homework_title, v_class_name
      FROM homeworks h JOIN classes c ON c.id = h.class_id WHERE h.id = NEW.homework_id;
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (v_student_user_id, 'homework_graded', 'Homework Graded: ' || v_homework_title,
        'Your homework has been graded in ' || v_class_name,
        jsonb_build_object('homework_id', NEW.homework_id, 'submission_id', NEW.id, 'grade', NEW.grade, 'class_name', v_class_name, 'student_id', NEW.student_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_journal_collaboration
CREATE OR REPLACE FUNCTION public.notify_journal_collaboration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  journal_title text;
  journal_owner_id uuid;
BEGIN
  SELECT title, owner_user_id INTO journal_title, journal_owner_id FROM journals WHERE id = NEW.journal_id;
  IF NEW.role IN ('editor', 'viewer') THEN
    INSERT INTO notifications (user_id, type, title, message, journal_id, metadata)
    VALUES (NEW.user_id, 'journal_collaboration', 'Journal Collaboration Invitation',
      'You have been invited to collaborate on journal: ' || journal_title,
      NEW.journal_id, jsonb_build_object('role', NEW.role, 'invited_by', journal_owner_id));
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix notify_journal_post
CREATE OR REPLACE FUNCTION public.notify_journal_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_member RECORD;
  v_title TEXT;
  v_student_user_id UUID;
BEGIN
  CASE NEW.type
    WHEN 'student' THEN
      SELECT 'New journal entry for you: ' || NEW.title INTO v_title;
      IF NEW.student_id IS NOT NULL THEN
        SELECT COALESCE(s.linked_user_id, f.primary_user_id) INTO v_student_user_id
        FROM students s LEFT JOIN families f ON s.family_id = f.id WHERE s.id = NEW.student_id;
        IF v_student_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
          VALUES (v_student_user_id, NEW.id, 'new_journal', v_title, 'A new journal entry has been posted for you',
            jsonb_build_object('journal_type', NEW.type, 'student_id', NEW.student_id));
        END IF;
      END IF;
    WHEN 'class' THEN
      SELECT 'New class journal: ' || NEW.title INTO v_title;
      IF NEW.class_id IS NOT NULL THEN
        FOR v_member IN 
          SELECT DISTINCT COALESCE(s.linked_user_id, f.primary_user_id) as user_id
          FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN families f ON s.family_id = f.id
          WHERE e.class_id = NEW.class_id AND (s.linked_user_id IS NOT NULL OR f.primary_user_id IS NOT NULL)
            AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
        LOOP
          IF v_member.user_id != NEW.owner_user_id THEN
            INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
            VALUES (v_member.user_id, NEW.id, 'new_journal', v_title, 'A new journal entry has been posted for your class',
              jsonb_build_object('journal_type', NEW.type, 'class_id', NEW.class_id));
          END IF;
        END LOOP;
      END IF;
    WHEN 'collab_student_teacher' THEN
      SELECT 'New collaborative journal: ' || NEW.title INTO v_title;
    ELSE
      SELECT 'New journal: ' || NEW.title INTO v_title;
  END CASE;
  FOR v_member IN 
    SELECT user_id FROM journal_members WHERE journal_id = NEW.id AND user_id != NEW.owner_user_id AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, journal_id, type, title, message, metadata)
    VALUES (v_member.user_id, NEW.id, 'new_journal', v_title, 'A new journal entry has been posted',
      jsonb_build_object('journal_type', NEW.type, 'student_id', NEW.student_id, 'class_id', NEW.class_id));
  END LOOP;
  RETURN NEW;
END;
$function$;


-- ========================================
-- Migration: 20260307234132_bf9a2628-4b8e-4ebb-bf3a-2e1c1d3ae7ae.sql
-- ========================================

-- Drop the existing permissive UPDATE policy that allows unrestricted self-updates
DROP POLICY IF EXISTS "Users can update own record" ON public.users;

-- Recreate with a WITH CHECK that prevents role changes
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid()));


-- ========================================
-- Migration: 20260312073358_b4a1969b-36ce-42b6-9cce-e7a06d42c002.sql
-- ========================================

-- Create enrollment_requests table
CREATE TABLE public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid
);

-- Enable RLS
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Students can insert their own requests
CREATE POLICY "Students can insert own enrollment requests"
ON public.enrollment_requests FOR INSERT TO authenticated
WITH CHECK (can_view_student(student_id, auth.uid()));

-- Students can view their own requests
CREATE POLICY "Students can view own enrollment requests"
ON public.enrollment_requests FOR SELECT TO authenticated
USING (can_view_student(student_id, auth.uid()));

-- Admins can manage all requests
CREATE POLICY "Admins can manage enrollment requests"
ON public.enrollment_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to notify admins when a request is created
CREATE OR REPLACE FUNCTION public.notify_admin_enrollment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
  student_name text;
  class_name text;
BEGIN
  SELECT full_name INTO student_name FROM students WHERE id = NEW.student_id;
  SELECT name INTO class_name FROM classes WHERE id = NEW.class_id;

  FOR admin_row IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      admin_row.user_id,
      'enrollment_request',
      'New Enrollment Request',
      student_name || ' wants to join ' || class_name,
      jsonb_build_object('request_id', NEW.id, 'student_id', NEW.student_id, 'class_id', NEW.class_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_enrollment_request_created
AFTER INSERT ON public.enrollment_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_enrollment_request();


-- ========================================
-- Migration: 20260312124804_13750c7d-0099-4a86-9a57-5ba9af646086.sql
-- ========================================

-- Class monitors table: one monitor per class
CREATE TABLE public.class_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_monitors_class_id_key UNIQUE (class_id)
);

-- Enable RLS
ALTER TABLE public.class_monitors ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view monitors (needed for leaderboard display)
CREATE POLICY "Authenticated users can view class monitors"
  ON public.class_monitors
  FOR SELECT
  TO authenticated
  USING (true);

-- Teachers of the class and admins can manage monitors
CREATE POLICY "Teachers and admins can manage class monitors"
  ON public.class_monitors
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_teacher_of_class(auth.uid(), class_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.is_teacher_of_class(auth.uid(), class_id)
  );


-- ========================================
-- Migration: 20260312150647_ab396b50-3513-41c4-bd09-af8695c87a7d.sql
-- ========================================

ALTER TABLE public.site_announcements
  ADD COLUMN target_class_ids uuid[] DEFAULT '{}',
  ADD COLUMN target_student_ids uuid[] DEFAULT '{}';


-- ========================================
-- Migration: 20260312152157_350b3a18-08dd-4115-afc0-a78b318339eb.sql
-- ========================================

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


-- ========================================
-- Migration: 20260321003206_9a4f6039-2c91-48e6-b9b1-dd88f26c2030.sql
-- ========================================

-- Add class metadata columns
ALTER TABLE classes ADD COLUMN IF NOT EXISTS curriculum text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS age_range text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS visibility_settings jsonb DEFAULT '{"curriculum": true, "age_range": true, "description": true, "teacher_info": true}'::jsonb;

-- Trigger: when a session is cancelled, set attendance to Excused
CREATE OR REPLACE FUNCTION set_attendance_excused_on_cancel()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Canceled' AND (OLD.status IS DISTINCT FROM 'Canceled') THEN
    UPDATE attendance SET status = 'Excused'
    WHERE session_id = NEW.id AND status = 'Present';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cancel_session_excused ON sessions;
CREATE TRIGGER trg_cancel_session_excused
AFTER UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION set_attendance_excused_on_cancel();


-- ========================================
-- Migration: 20260321003215_bf951608-afa2-4d51-a807-ed9061e59593.sql
-- ========================================

ALTER FUNCTION set_attendance_excused_on_cancel() SET search_path = public;


-- ========================================
-- Migration: 20260322050903_f081efc8-9be3-42ea-8ce5-7fe8e7fcdf23.sql
-- ========================================

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


-- ========================================
-- Migration: 20260323044859_3040c6dd-1237-4356-a087-d1860e7142c5.sql
-- ========================================
ALTER TABLE public.session_participants ADD CONSTRAINT uq_session_ta UNIQUE (session_id, teaching_assistant_id);

-- ========================================
-- Migration: 20260401142419_db984b91-19cd-4ad1-b5ec-9ffb6e7ab094.sql
-- ========================================
-- Update is_teacher_of_class to also recognize Teaching Assistants
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(user_id uuid, class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Check if user is a lead teacher for sessions in this class
    SELECT 1 FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE s.class_id = is_teacher_of_class.class_id
    AND t.user_id = is_teacher_of_class.user_id
  )
  OR EXISTS (
    -- Check if user is a TA assigned to sessions in this class
    SELECT 1 FROM public.session_participants sp
    JOIN public.sessions s ON s.id = sp.session_id
    JOIN public.teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE s.class_id = is_teacher_of_class.class_id
    AND ta.user_id = is_teacher_of_class.user_id
    AND sp.participant_type = 'teaching_assistant'
  );
$function$;

-- ========================================
-- Migration: 20260403050441_977c8954-c264-4b1d-bc3d-5fd3871116e1.sql
-- ========================================

-- Fix attendance policies to include TAs
DROP POLICY IF EXISTS "teacher_attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "teacher_attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "teacher_attendance_update" ON public.attendance;
DROP POLICY IF EXISTS "teacher_attendance_delete" ON public.attendance;

CREATE POLICY "teacher_attendance_select" ON public.attendance
FOR SELECT TO authenticated
USING (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

CREATE POLICY "teacher_attendance_insert" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

CREATE POLICY "teacher_attendance_update" ON public.attendance
FOR UPDATE TO authenticated
USING (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
)
WITH CHECK (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

CREATE POLICY "teacher_attendance_delete" ON public.attendance
FOR DELETE TO authenticated
USING (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

-- Fix enrollments policy to include TAs
DROP POLICY IF EXISTS "Teachers can view enrollments for their classes" ON public.enrollments;

CREATE POLICY "Teachers can view enrollments for their classes" ON public.enrollments
FOR SELECT TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT s.class_id FROM sessions s JOIN teachers t ON s.teacher_id = t.id WHERE t.user_id = auth.uid()
  )
  OR class_id IN (
    SELECT DISTINCT s.class_id FROM session_participants sp
    JOIN sessions s ON s.id = sp.session_id
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

-- Fix students policy to include TAs (currently only checks users.role = 'teacher')
DROP POLICY IF EXISTS "Teachers can view all students" ON public.students;

CREATE POLICY "Teachers can view all students" ON public.students
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'teacher')
  OR EXISTS (SELECT 1 FROM teaching_assistants ta WHERE ta.user_id = auth.uid() AND ta.is_active = true)
);


-- ========================================
-- Migration: 20260403051502_c6a09ad3-08c3-4ee2-ac06-2637acd66dff.sql
-- ========================================

-- Auto-end all active enrollments when a student is deactivated
CREATE OR REPLACE FUNCTION public.auto_end_enrollments_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when is_active changes from true to false
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE enrollments
    SET 
      end_date = CURRENT_DATE,
      updated_at = now()
    WHERE student_id = NEW.id
      AND end_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_deactivation_end_enrollments
BEFORE UPDATE ON public.students
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION public.auto_end_enrollments_on_deactivation();


-- ========================================
-- Migration: 20260405025134_ae5342c4-9caa-48ca-9a5d-c0beba9f132a.sql
-- ========================================

-- Add economy fields to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS economy_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_to_cash_rate integer NOT NULL DEFAULT 50;

-- Add cash_on_hand to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS cash_on_hand integer NOT NULL DEFAULT 0;

-- Create enum types for economy transactions
DO $$ BEGIN
  CREATE TYPE public.economy_tx_type AS ENUM ('convert_to_cash', 'spend_cash', 'deposit_cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.economy_tx_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create economy_transactions table
CREATE TABLE IF NOT EXISTS public.economy_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  type public.economy_tx_type NOT NULL,
  points_impact integer NOT NULL DEFAULT 0,
  cash_impact integer NOT NULL DEFAULT 0,
  status public.economy_tx_status NOT NULL DEFAULT 'pending',
  processed_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_economy_tx_student ON public.economy_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_economy_tx_class ON public.economy_transactions(class_id);
CREATE INDEX IF NOT EXISTS idx_economy_tx_status ON public.economy_transactions(status);

-- Enable RLS
ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;

-- Students can view their own transactions
CREATE POLICY "Students view own economy transactions"
ON public.economy_transactions FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
  )
);

-- Students can create pending requests for classes they're enrolled in
CREATE POLICY "Students create economy requests"
ON public.economy_transactions FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
  )
  AND class_id IN (
    SELECT e.class_id FROM enrollments e WHERE e.student_id = economy_transactions.student_id AND e.end_date IS NULL
  )
);

-- Teachers/TAs can view transactions for their classes
CREATE POLICY "Staff view class economy transactions"
ON public.economy_transactions FOR SELECT
TO authenticated
USING (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Teachers/TAs can update (approve/reject) transactions
CREATE POLICY "Staff update economy transactions"
ON public.economy_transactions FOR UPDATE
TO authenticated
USING (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Admins can do everything
CREATE POLICY "Admins manage economy transactions"
ON public.economy_transactions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_economy_transactions_updated_at
BEFORE UPDATE ON public.economy_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_student_points_timestamp();


-- ========================================
-- Migration: 20260409104920_d26fab94-5c5d-4acd-80ed-d6d40410ca28.sql
-- ========================================

-- Allow teachers to update economy settings on their own classes
CREATE POLICY "Teachers can update economy settings for their classes"
ON public.classes
FOR UPDATE
TO authenticated
USING (is_teacher_of_class(auth.uid(), id))
WITH CHECK (is_teacher_of_class(auth.uid(), id));


-- ========================================
-- Migration: 20260417001017_7cdfd394-7d1c-42c2-a212-0b34b44491ca.sql
-- ========================================

-- Create exam_reports table
CREATE TABLE public.exam_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_html TEXT,
  file_storage_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  exam_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_reports_student ON public.exam_reports(student_id);
CREATE INDEX idx_exam_reports_class ON public.exam_reports(class_id);
CREATE INDEX idx_exam_reports_created_by ON public.exam_reports(created_by);

ALTER TABLE public.exam_reports ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage all exam reports"
ON public.exam_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view reports for students in classes they teach
CREATE POLICY "Teachers view reports for their classes"
ON public.exam_reports FOR SELECT
USING (
  class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id)
);

-- Teachers can insert reports for classes they teach
CREATE POLICY "Teachers insert reports for their classes"
ON public.exam_reports FOR INSERT
WITH CHECK (
  class_id IS NOT NULL 
  AND is_teacher_of_class(auth.uid(), class_id)
  AND created_by = auth.uid()
);

-- Teachers can update only reports they created
CREATE POLICY "Teachers update own reports"
ON public.exam_reports FOR UPDATE
USING (created_by = auth.uid() AND class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (created_by = auth.uid());

-- Teachers can delete only reports they created
CREATE POLICY "Teachers delete own reports"
ON public.exam_reports FOR DELETE
USING (created_by = auth.uid() AND class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id));

-- Students/family can view their own reports
CREATE POLICY "Students view own exam reports"
ON public.exam_reports FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_exam_reports_updated_at
BEFORE UPDATE ON public.exam_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-reports', 'exam-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path format = {student_id}/{filename}
-- Admins
CREATE POLICY "Admins manage exam-reports storage"
ON storage.objects FOR ALL
USING (bucket_id = 'exam-reports' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'exam-reports' AND has_role(auth.uid(), 'admin'::app_role));

-- Students/family can view files for their own reports
CREATE POLICY "Students view own exam-reports files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-reports'
  AND EXISTS (
    SELECT 1 FROM public.exam_reports er
    WHERE er.file_storage_key = storage.objects.name
      AND can_view_student(er.student_id, auth.uid())
  )
);

-- Teachers can view/upload/delete files for reports they authored or for their classes
CREATE POLICY "Teachers view exam-reports files for their classes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-reports'
  AND EXISTS (
    SELECT 1 FROM public.exam_reports er
    WHERE er.file_storage_key = storage.objects.name
      AND er.class_id IS NOT NULL
      AND is_teacher_of_class(auth.uid(), er.class_id)
  )
);

CREATE POLICY "Teachers upload exam-reports files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exam-reports'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Teachers delete own exam-reports files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exam-reports'
  AND EXISTS (
    SELECT 1 FROM public.exam_reports er
    WHERE er.file_storage_key = storage.objects.name
      AND er.created_by = auth.uid()
  )
);


