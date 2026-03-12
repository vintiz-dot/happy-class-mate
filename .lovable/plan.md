

## Problem

`ProfilePicker` is rendered globally in `App.tsx` (line `<ProfilePicker />`) for **every authenticated user**. It doesn't check the user's role before querying for linked students. When an admin (who naturally has no linked student records) logs in, it finds 0 students and displays the "Account Not Linked Yet" full-screen overlay — blocking the entire app.

## Fix

Add a role check at the top of `ProfilePicker`. The component should only run its student-linking logic for `student` and `family` roles. For `admin` and `teacher` roles, it should immediately return `null`.

### Changes

**`src/components/ProfilePicker.tsx`**
- Import and call `useAuth()` to get the current user's role
- Early return `null` if `role` is `admin` or `teacher` (or if role is still loading)
- This ensures the "Account Not Linked" overlay only ever appears for student/family accounts

```tsx
// At the top of the component:
const { role, loading: authLoading } = useAuth();

// Early exit for non-student roles
if (authLoading) return null;
if (role === "admin" || role === "teacher") return null;
```

No other files need changes.

