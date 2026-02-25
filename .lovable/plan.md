

# Clean Up Class Transfers — Stop Showing Old Class Data

## Problem

When a student transfers from one class to another (e.g., Cherry moves from Venus to Jupiter), multiple components still show homework, sessions, and attendance from the **old class** because they query enrollments without respecting `end_date` or enrollment date ranges. This means:

- The schedule calendar shows old class sessions and homework as "missed"
- The assignments list only filters by `end_date IS NULL` (correct), but the calendar does not
- The attendance heatmap shows old class data
- Streak calculations include old class sessions

## Affected Files and Fixes

### 1. `src/components/student/StudentScheduleCalendar.tsx` (lines 36-39)

**Current:** Queries ALL enrollments regardless of dates:
```ts
.from("enrollments")
.select("class_id")
.eq("student_id", studentId);
```

**Fix:** Fetch enrollments with `start_date` and `end_date`, then for the selected month only use class IDs where the enrollment overlaps that month. Also filter sessions per-enrollment so a session from Venus only appears if Cherry was enrolled in Venus on that session's date. Same logic for homeworks — only show homework from a class if the student was enrolled when it was due.

For streaks (lines 77-83), similarly scope to only active enrollments.

### 2. `src/components/student/AttendanceHeatmap.tsx` (lines 33-36)

**Same problem:** Queries all enrollments without date filtering. Apply the same overlap-based filtering.

### 3. `src/components/student/StudentAttendanceTab.tsx` (lines 67-83)

**Partially correct:** It already fetches `start_date, end_date` and filters sessions by enrollment dates. No changes needed here.

### 4. `src/components/student/WeeklyProgressCard.tsx` (lines 20-25)

**Current:** Uses `.is("end_date", null)` which is correct for showing only active classes. No change needed.

### 5. `src/pages/StudentDashboard.tsx` (lines 149-153, 184-188)

**Current:** Uses `.is("end_date", null)` for upcoming sessions and pending homework. Correct for future-looking queries. No change needed.

## Implementation Approach

For the two main files that need fixing (`StudentScheduleCalendar.tsx` and `AttendanceHeatmap.tsx`):

1. Change the enrollment query to fetch `class_id, start_date, end_date` instead of just `class_id`
2. For session/homework filtering, build a helper that checks whether a given date falls within any enrollment's active period for that class
3. When building `classIds` for bulk queries, include all historically enrolled class IDs, but then post-filter each session/homework against the enrollment date range
4. For homework specifically: only show homework as "missed" if the student was enrolled in that class on the homework's due date
5. For streaks: only count sessions from classes the student was enrolled in on that session date

### Technical Detail

The key filtering logic:

```typescript
// Fetch enrollments with dates
const { data: enrollments } = await supabase
  .from("enrollments")
  .select("class_id, start_date, end_date")
  .eq("student_id", studentId);

// Helper: was student enrolled in this class on this date?
const wasEnrolled = (classId: string, date: string) =>
  enrollments?.some(e =>
    e.class_id === classId &&
    e.start_date <= date &&
    (!e.end_date || e.end_date >= date)
  ) ?? false;

// Filter sessions after fetching
const filteredSessions = sessionsRes.data?.filter(s => wasEnrolled(s.class_id, s.date));

// Filter homeworks after fetching
const filteredHomeworks = homeworksRes.data?.filter(hw => wasEnrolled(hw.class_id, hw.due_date));
```

No database changes needed. This is purely a client-side filtering fix in two component files.

