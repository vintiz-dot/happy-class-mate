

# Plan: Overdue Alerts from Real Balances + Comprehensive Assignments Overview

## Two major changes requested:

---

## Part 1: Admin Alerts — Use Real Student Balances

### Problem
The current alert system queries `invoices` with `carry_out_debt` from past months, but this is fragile — it depends on invoices existing and being up to date. The user wants the same balance logic visible on `/students/:id` (prior balance breakdown) to drive the alerts: loop over all students, compute who has outstanding debt, and show those in alerts.

### Approach
Instead of querying raw invoice fields, query all invoices across all past months for all active students in a single bulk fetch. For each student, compute the **net balance** (total charged minus total paid via `recorded_payment`) across all months. Students with a positive net debt appear as overdue alerts.

**File: `src/components/admin/AdminAlerts.tsx`**
- Replace the overdue invoices query (lines 30-36) with a bulk query:
  - Fetch all invoices where `month < currentMonth` for active students
  - Select `student_id, month, total_amount, recorded_payment, carry_out_debt, status`
  - Also fetch `students(full_name)` join
  - Remove `.limit(50)` — get all historical invoices
  - Remove `.in("status", ["draft", "issued"])` — include all statuses to compute true balance
- For each student, sum up: `totalCharged = sum(total_amount)`, `totalPaid = sum(recorded_payment)`
- Net debt = `totalCharged - totalPaid`; if > 0, flag as overdue
- This mirrors the prior balance breakdown logic used in the student detail page

---

## Part 2: Comprehensive Assignments Overview

### Problem
The current `AssignmentsOverview` is minimal — 4 stat cards, a calendar (that only works for students), and a basic list capped at 50 items. No filtering, no per-class/per-teacher/per-student drill-down, no submission rate analytics, no visualizations.

### Approach
Rebuild `AssignmentsOverview` as a multi-tab analytics dashboard with filters and visualizations.

### Data Query Redesign
**Replace the current query** (limited to 50 homeworks) with a comprehensive bulk fetch:
- All homeworks with `classes(id, name, default_teacher_id)` and `homework_submissions(id, status, student_id, submitted_at, graded_at, grade)`
- All active enrollments to compute "expected submissions" per class
- All teachers to map `default_teacher_id` to teacher names
- All active students for student-level detail

### New Tab Structure
Replace the current Calendar/List tabs with:

```text
Tabs: [Global] [By Class] [By Teacher] [By Student]
```

**Global Tab:**
- Enhanced stat cards: Total Assignments, Total Expected Submissions (enrolled students x assignments), Actual Submissions, Submission Rate %, Graded %, Average Grade
- Submission rate over time chart (recharts BarChart) — assignments on x-axis, submission % on y-axis
- Grading turnaround: average days between `submitted_at` and `graded_at`
- Grade distribution pie chart
- Keep the calendar view as a sub-section

**By Class Tab:**
- Class selector dropdown (or show all classes as expandable cards)
- Per-class stats: assignments count, submission rate, grading rate, average grade
- Table: each assignment row with due date, submissions/enrolled, graded count, average grade
- Bar chart comparing submission rates across classes

**By Teacher Tab:**
- Teacher selector dropdown
- Stats for assignments created by classes the teacher owns (`default_teacher_id`)
- Grading performance: average turnaround time, grading completion rate
- Table of their assignments with drill-down stats

**By Student Tab:**
- Student selector dropdown (searchable)
- Per-student stats: assignments given, submitted, graded, submission rate, average grade
- Table of each assignment with status, grade, submission date
- Attendance vs submission correlation indicator

### Filters
- Month range filter (shared across tabs): filter assignments by `due_date` range
- Status filter: All / Pending / Submitted / Graded

### Visualizations (using recharts, already installed)
- `BarChart` for submission rates by class
- `PieChart` for grade distribution (A/B/C/etc or numeric buckets)
- `LineChart` for submission trends over time
- `ResponsiveContainer` wrapper for all charts

### Files Changed

**Modified:**
- `src/components/admin/AssignmentsOverview.tsx` — complete rebuild with tabs, filters, stats, charts
- `src/components/admin/AdminAlerts.tsx` — overdue balance calculation fix

**New files:**
- `src/components/admin/assignments/AssignmentGlobalView.tsx` — global stats + charts
- `src/components/admin/assignments/AssignmentByClassView.tsx` — per-class breakdown
- `src/components/admin/assignments/AssignmentByTeacherView.tsx` — per-teacher breakdown  
- `src/components/admin/assignments/AssignmentByStudentView.tsx` — per-student breakdown
- `src/hooks/useAssignmentAnalytics.ts` — shared hook for bulk data fetching and computation

### Hook Design: `useAssignmentAnalytics`
Single hook that fetches all data once and computes derived stats:
```typescript
// Fetches: homeworks + submissions, enrollments, classes, teachers, students
// Returns computed analytics:
{
  global: { totalAssignments, totalExpected, totalSubmitted, submissionRate, gradedCount, avgGrade, ... },
  byClass: Map<classId, { className, assignments, submissionRate, gradingRate, avgGrade, ... }>,
  byTeacher: Map<teacherId, { teacherName, assignments, gradingTurnaround, ... }>,
  byStudent: Map<studentId, { studentName, assigned, submitted, graded, avgGrade, ... }>,
  raw: { homeworks, submissions, enrollments }
}
```

### No database changes needed
All data comes from existing `homeworks`, `homework_submissions`, `enrollments`, `classes`, `teachers`, `students` tables.

---

## Summary of Files

| Action | File |
|--------|------|
| Modified | `src/components/admin/AdminAlerts.tsx` |
| Modified | `src/components/admin/AssignmentsOverview.tsx` |
| Created | `src/hooks/useAssignmentAnalytics.ts` |
| Created | `src/components/admin/assignments/AssignmentGlobalView.tsx` |
| Created | `src/components/admin/assignments/AssignmentByClassView.tsx` |
| Created | `src/components/admin/assignments/AssignmentByTeacherView.tsx` |
| Created | `src/components/admin/assignments/AssignmentByStudentView.tsx` |

