## Problem

The `AttendanceHeatmap` component was created but only added to the **admin** student detail page (`StudentDetail.tsx` → Attendance tab). It is not accessible from any student-facing page. The student navigation bar has no "Attendance" link either.

## Plan

### Add the Attendance Heatmap to the Student Dashboard

1. **Edit `src/pages/StudentDashboard.tsx**`
  - Import `AttendanceHeatmap`
  - Add it as a new card/section on the dashboard (below the Weekly Progress card or as a new tab), passing the current student's ID
  - Wrap it in a Card with a "My Attendance" header. then also include points and details of the points earned in that session so when the attendance is clicked the points breakdown for that day is displayed in a popup
2. **Optionally add an "Attendance" item to `StudentNavBar.tsx**`
  - Add an "Attendance" entry to the `allNavItems` array pointing to `/student/dashboard?tab=attendance`
  - This gives students a direct way to navigate to their attendance view

### Technical Details

- The `AttendanceHeatmap` component already accepts a `studentId` prop and is fully self-contained (fetches its own data)
- The student dashboard already has access to the student profile context which provides the student ID
- No database changes needed — the component queries existing `enrollments`, `sessions`, and `attendance` tables