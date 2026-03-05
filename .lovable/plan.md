## Problem

The `teachers.user_id` column has a NOT NULL constraint in the database. The "Unlink" button in `TeacherLinkDialog` tries to `UPDATE teachers SET user_id = NULL`, which fails.

This is a legitimate use case: teachers should be creatable without an associated auth user, and unlinking should be possible.

## Fix

### 1. Database Migration — Make `teachers.user_id` nullable. do the same for students and families too

```sql
ALTER TABLE public.teachers ALTER COLUMN user_id DROP NOT NULL;
```

This is safe because:

- The `create-teacher` edge function already creates teachers with a `user_id`, but unlinking is a valid admin action
- RLS policies use `user_id` via `is_teacher_of_class()` which already handles the join gracefully
- The foreign key constraint remains intact (just allows NULL)

### 2. No code changes needed

The `TeacherLinkDialog.tsx` unlink mutation already correctly sets `user_id: null` — it just needs the DB constraint removed. The `FamilyLinkDialog.tsx` sets `primary_user_id: null` on `families`, which is already nullable per the types (`primary_user_id: string | null`), so no issue there.

### Files

- **Migration**: `ALTER TABLE teachers ALTER COLUMN user_id DROP NOT NULL`
- No frontend code changes