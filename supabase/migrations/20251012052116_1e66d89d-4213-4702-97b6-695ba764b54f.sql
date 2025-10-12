-- Remove the student role from test@admin.com
DELETE FROM public.user_roles 
WHERE user_id = '7f7cb9d5-3ef2-4f50-b9e8-c6085bfddc06' 
AND role = 'student';