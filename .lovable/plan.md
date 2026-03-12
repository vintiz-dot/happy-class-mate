

## Problem

`lambaba@gmail.com` has a `student` role but **no student record** in the `students` table (no `linked_user_id` match, no family link). So:

1. `ProfilePicker` finds 0 students → returns `null` (correct)
2. `StudentProfileContext` has `studentId = undefined`
3. `StudentDashboard` hits the guard at line 331: `if (!studentId || !studentProfile)` → shows **"Please select a student profile"**
4. The `DemoDashboard` code at line 353 is **unreachable** because it requires `studentId` to exist first

The DemoDashboard was designed for students who have a student record but zero enrollments. But a truly "new" user (just signed up, no student record created yet) never gets past the `!studentId` guard.

## Fix

Restructure `StudentDashboard` to handle the case where a student-role user has **no student record at all**:

1. **In `StudentDashboard.tsx`** — Before the `!studentId` guard, detect the "no student record" state by checking if the user has the student role but `studentId` is undefined (and ProfilePicker has hydrated). In that case, render the `DemoDashboard` with minimal/null student info instead of showing "Please select a student profile."

2. **Modify `DemoDashboard.tsx`** — Make the `student` prop optional so it can render with just a user email/name fallback when no student record exists yet.

3. **Flow after fix:**
   - User signs up → gets `student` role → no student record exists
   - `studentId` is `undefined`, `isHydrated` is `true`
   - StudentDashboard detects this → renders DemoDashboard with user info from auth
   - DemoDashboard shows the premium preview + class catalog for enrollment

### Files to edit
- `src/pages/StudentDashboard.tsx` — Replace the `!studentId` fallback with auth-aware logic that shows DemoDashboard for student-role users with no linked profile
- `src/components/student/DemoDashboard.tsx` — Make `student` prop optional, fall back to auth user display name/email

