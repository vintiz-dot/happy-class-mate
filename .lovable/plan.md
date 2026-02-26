

# Assignments Overview Improvements

## 1. Default Grade Scale
Add a kid-friendly grade selector to `HomeworkGrading.tsx` with predefined options based on point ranges. The grade field becomes a dropdown with these defaults (user can still type custom):
- **Superstar** (90-100 pts)
- **Amazing** (80-89 pts)
- **Great Job** (70-79 pts)
- **Good Try** (60-69 pts)
- **Keep Trying** (50-59 pts)
- **Needs Help** (0-49 pts)

The points field and feedback field remain unchanged.

## 2. Grade Distribution — Group by Points
In `AssignmentGlobalView.tsx`, replace the raw grade string distribution pie chart with a points-based bar chart grouped in buckets of 10:
- 90-100, 80-89, 70-79, 60-69, 50-59, 40-49, 30-39, 20-29, 10-19, 0-9
- Source: `point_transactions` where `type = 'homework'`, grouped by points value
- Update `useAssignmentAnalytics.ts` to fetch point_transactions for homework and compute the bucket distribution

## 3. By Class View — Collapsible Classes
In `AssignmentByClassView.tsx`:
- Replace the flat list of class cards with `Collapsible` components (already available in the project)
- Each class header shows stats inline (name, teacher, submission rate, grading rate)
- Click to expand/collapse the assignment table inside
- Default state: all collapsed

## 4. By Teacher View — Class Toggle
In `AssignmentByTeacherView.tsx`:
- Add class-level filtering within each teacher card
- Add a toggle group or multi-select showing all classes the teacher owns
- Allow toggling individual classes on/off to filter the assignment table
- Fix the current issue where all assignments show in one flat list

## 5. By Student View — Clickable Student Rows
In `AssignmentByStudentView.tsx`:
- Make each student row clickable
- On click, expand an inline detail panel (or dialog) showing:
  - Student stats summary (assigned, submitted, graded, rate)
  - List of all homework assignments for that student with: title, class, due date, status, grade, points, submission date
  - Filter by class if enrolled in multiple

## Files Changed

| Action | File |
|--------|------|
| Modified | `src/components/teacher/HomeworkGrading.tsx` — add grade preset selector |
| Modified | `src/hooks/useAssignmentAnalytics.ts` — add points bucket distribution |
| Modified | `src/components/admin/assignments/AssignmentGlobalView.tsx` — points-based grade distribution chart |
| Modified | `src/components/admin/assignments/AssignmentByClassView.tsx` — collapsible class cards |
| Modified | `src/components/admin/assignments/AssignmentByTeacherView.tsx` — per-class toggle filter |
| Modified | `src/components/admin/assignments/AssignmentByStudentView.tsx` — clickable rows with detail panel |

