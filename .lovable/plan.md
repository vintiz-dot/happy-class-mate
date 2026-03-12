

## Plan: Fix ProfilePicker Logout Bug + Class Monitor System

### Part 1: Fix ProfilePicker Persisting After Logout

**Problem**: `ProfilePicker` runs `loadStudents` once on mount with `useEffect([], [])`. When the user logs out, the component doesn't re-run — so the "Account Not Linked" overlay stays visible even on the auth page.

**Fix** in `src/components/ProfilePicker.tsx`:
- Add a Supabase `onAuthStateChange` listener inside the existing `useEffect`
- On `SIGNED_OUT`, reset `students` to `null` and `loading` to `false`
- On `SIGNED_IN` / `TOKEN_REFRESHED`, re-run `loadStudents`
- Clean up subscription on unmount

### Part 2: Class Monitor System

**Concept**: Teachers can assign one student per class as the "Class Monitor" — a leadership role with a premium visual treatment on leaderboards and an upgraded dashboard experience. This is UI/UX only (no extra permissions).

#### Database Changes

**New table: `class_monitors`**
- `id` (uuid, PK)
- `class_id` (uuid, FK → classes, unique) — one monitor per class
- `student_id` (uuid, FK → students)
- `assigned_by` (uuid) — teacher user_id
- `assigned_at` (timestamptz, default now())

RLS:
- Authenticated users can SELECT (public info for leaderboard display)
- Teachers of the class can INSERT/UPDATE/DELETE
- Admins can manage all

#### Leaderboard Enhancement (`StudentClassLeaderboard.tsx`)

- Query `class_monitors` alongside leaderboard data
- If a student is the monitor, show a premium badge/crown indicator next to their name
- Special gradient border and a "Class Monitor" badge with a shield icon
- Subtle animated glow effect on the monitor's leaderboard row

#### Monitor Dashboard Enhancements (`StudentDashboard.tsx`)

- Query `class_monitors` to check if current student is a monitor for any class
- If yes, add visual upgrades (UI/UX only, no functional differences):
  - Premium hero section with a "Class Monitor" title badge and shield icon
  - Enhanced gradient background with gold/royal tones
  - "Monitor Status" card showing which class(es) they monitor
  - Animated crown/shield accent on their level ring

#### Teacher Assignment UI

- Add a "Set Monitor" option in the teacher's class detail view or leaderboard
- Simple dropdown/dialog to pick a student from the enrolled list
- Only one monitor per class — assigning a new one replaces the previous

### Files to Create
- None (all changes in existing files + DB migration)

### Files to Edit
- `src/components/ProfilePicker.tsx` — auth state listener fix
- `src/components/student/StudentClassLeaderboard.tsx` — monitor badge on leaderboard
- `src/pages/StudentDashboard.tsx` — monitor-enhanced dashboard visuals
- `src/components/teacher/LiveAssessmentGrid.tsx` or teacher class view — "Set Monitor" UI
- Database migration — `class_monitors` table + RLS

