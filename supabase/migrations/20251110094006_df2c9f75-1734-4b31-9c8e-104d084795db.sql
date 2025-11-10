-- Add avatar_url column to teachers table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS avatar_url TEXT;