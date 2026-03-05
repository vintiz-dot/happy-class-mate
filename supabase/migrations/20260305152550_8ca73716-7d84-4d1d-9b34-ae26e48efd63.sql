ALTER TABLE public.teachers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN linked_user_id DROP NOT NULL;