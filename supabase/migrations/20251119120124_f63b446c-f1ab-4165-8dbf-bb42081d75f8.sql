-- Add assignment_instructions column to homework_submissions to store a copy of the instructions
ALTER TABLE homework_submissions
ADD COLUMN IF NOT EXISTS assignment_instructions TEXT;