-- Make homework bucket public for easy file access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'homework';