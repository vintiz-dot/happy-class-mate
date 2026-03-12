

## Plan: Inactive/Unenrolled Student Landing Experience

### Overview

Build a smart landing page system that detects whether a student has no active enrollments and routes them to a tailored experience. Two variants:

1. **Returning students** (had enrollments before, all ended) — "We miss you" experience with access to historical data + class browsing + re-enrollment request pipeline
2. **New students** (never enrolled) — "Get started" onboarding experience with class browsing + enrollment request pipeline

Both variants include a class catalog showing available classes with schedules (no pricing), and a "Request to Join" flow that notifies the admin.

### Database Changes

**New table: `enrollment_requests`**
- `id` (uuid, PK)
- `student_id` (uuid, FK → students)
- `class_id` (uuid, FK → classes)
- `status` (text, default `'pending'`) — pending / approved / declined
- `message` (text, nullable) — optional student note
- `created_at`, `resolved_at`, `resolved_by`
- RLS: students can insert/view own, admins can manage all

### Enrollment Status Detection

In `StudentDashboard.tsx`, add a query to check:
- Does the student have *any* enrollments where `end_date IS NULL`? → Active, show normal dashboard
- Does the student have *any* enrollments at all (even ended)? → Returning student landing
- No enrollments whatsoever? → New student landing

### New Components

**1. `src/components/student/InactiveStudentLanding.tsx`**
- Renders inside `StudentDashboard` when no active enrollments detected
- Two visual variants based on `isReturning` boolean

**Returning student variant:**
- Warm "Welcome back" hero with their name, avatar, level ring (preserving XP)
- Urgency messaging: "Your classmates are earning XP without you!", show leaderboard snippets
- Social proof: "X students are currently learning"
- Quick-access cards to historical data (past grades, attendance history, financial records)
- Class catalog grid below
- Prominent "Come Back" CTA

**New student variant:**
- Exciting "Start Your Journey" hero
- Benefits showcase (XP system, achievements, leaderboards)
- Social proof: active student count
- Class catalog grid
- Prominent "Join a Class" CTA

**2. `src/components/student/ClassCatalog.tsx`**
- Fetches all active classes with `schedule_template`, `default_teacher_id` → teacher name
- Displays each class as a card: name, schedule days/times, teacher name
- No pricing shown (explicitly excluded: `session_rate_vnd`)
- Each card has a "Request to Join" button
- On click → confirmation dialog with optional message field → inserts into `enrollment_requests`
- Toast confirmation: "Request sent! The admin will review it shortly."

**3. Admin notification integration**
- Insert a notification row for admin users when a request is created (via DB trigger)
- Add an `enrollment_requests` management section in the admin panel (simple list with approve/decline)

### Routing Logic Changes

In `StudentDashboard.tsx`, wrap the main dashboard content:
```
if (activeEnrollments.length === 0) {
  return <InactiveStudentLanding 
    student={studentProfile}
    isReturning={hasAnyPastEnrollments}
    studentId={studentId}
  />;
}
// ... existing dashboard
```

Returning students still get access to historical tabs (schedule showing past sessions, tuition history) via tab navigation on the landing page itself.

### Files to Create
- `src/components/student/InactiveStudentLanding.tsx` — main landing with two variants
- `src/components/student/ClassCatalog.tsx` — class browsing + request flow

### Files to Edit
- `src/pages/StudentDashboard.tsx` — add enrollment status check, conditionally render landing
- Database migration — create `enrollment_requests` table + RLS + admin notification trigger

### Admin Side
- Add a small `EnrollmentRequestsManager` component showing pending requests with approve (creates enrollment) / decline actions
- Surface in the admin Students tab or as a notification badge

