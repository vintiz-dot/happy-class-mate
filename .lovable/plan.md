

## Problem

A new user account with the "student" role has no linked `students` record in the database. The `ProfilePicker` finds 0 students and hides itself. The `StudentDashboard` sees `studentId` is undefined and shows "Please select a student profile" — a dead end with no actionable path.

## Root Cause

The flow assumes every student-role user already has a `students` record linked via `linked_user_id` or `family_id`. New signups don't have this link yet.

## Solution

When `ProfilePicker` loads 0 students, instead of returning `null`, show a meaningful landing state. In `StudentDashboard`, handle the "no studentId AND no linked students" case separately from "multiple students, pick one."

### Changes

**1. `src/components/ProfilePicker.tsx`**
- When `students` array is empty (length === 0), show a friendly message: "Your account isn't linked to a student profile yet. Please contact the administrator to get set up."
- This replaces the current behavior of silently returning `null`.

**2. `src/pages/StudentDashboard.tsx`** (lines 325-339)
- Replace the generic "Please select a student profile" message with a more helpful state that distinguishes:
  - No students linked at all → "Your account hasn't been linked to a student profile yet. Please contact your administrator."
  - Multiple students, none selected → Current "Please select a student profile" (ProfilePicker handles this)

**3. `src/components/student/InactiveStudentLanding.tsx`** (reuse opportunity)
- The new-student variant of the inactive landing could serve double duty here, but the core issue is the user has no `students` record at all — so a simpler "pending setup" message is more appropriate.

### Implementation Detail

In `ProfilePicker.tsx`, change the early return condition:
```
// Before: if students.length < 2, return null
// After: if students.length === 0, show "account not linked" card
//        if students.length === 1, auto-select and return null  
//        if students.length >= 2 && studentId set, return null
```

In `StudentDashboard.tsx`, the fallback at line 325 stays as a safety net but the `ProfilePicker` now handles the empty case visually.

### Files to Edit
- `src/components/ProfilePicker.tsx` — handle 0-students case with a friendly card
- `src/pages/StudentDashboard.tsx` — improve the no-studentId fallback message

