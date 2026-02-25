

# Merge Schedule + Attendance into a Kid-Friendly "My Classes" Calendar

## Problem

Students currently have two separate views for related data:
- **Schedule page** (`/schedule`) -- uses PremiumCalendar (complex, admin-oriented, 855 lines)
- **Attendance tab** (`/student/dashboard?tab=attendance`) -- month-grid heatmap with XP trend

These serve overlapping purposes. A grade 3 student (~8 years old) shouldn't need to navigate between two calendars. The PremiumCalendar is powerful but not designed for young children.

## Plan

### 1. Create a new `StudentScheduleCalendar` component

**New file:** `src/components/student/StudentScheduleCalendar.tsx`

A purpose-built, kid-friendly calendar that merges schedule + attendance into one view with:

**Visual design for 8-year-olds:**
- Large, rounded day cells with emoji indicators instead of tiny text
- Color-coded days: 🟢 attended, 🔵 upcoming class, ⚪ no class, 🟡 homework due
- Fun animated mascot-style header ("Your Class Calendar! 📅")
- Big, tappable day cells (minimum 48px touch targets)
- Friendly fonts, soft gradients, bouncy animations

**Past days (on click popover):**
- ✅ Attendance status with celebratory check marks
- ⚡ XP points earned that day with breakdown by category
- 📝 Homework that was due that day + submission status (submitted/graded/missed)
- 📋 Recent homework assigned around that date

**Future days (on click popover):**
- 📅 Scheduled class name and time
- 👩‍🏫 Teacher name with avatar
- 📝 Homework due that day with countdown
- Status badges ("Coming up!", "Tomorrow!")

**Data fetching (single query):**
- Sessions with class name, teacher name, status
- Attendance records for the student
- Point transactions for XP breakdown
- Homeworks with due dates for enrolled classes
- Homework submissions for the student

**Month picker:** Reuse existing `MonthPicker` component, styled larger for kids

**XP trend line chart:** Keep the recharts LineChart at the bottom, styled with fun colors

**Streak display:** Keep the flame streak counter, make it bigger and more celebratory

### 2. Update Student Navigation

**Edit:** `src/components/student/StudentNavBar.tsx`
- Remove the separate "Attendance" nav item
- Keep "Schedule" as the merged destination, but route it to `/student/dashboard?tab=schedule` instead of `/schedule`

### 3. Update StudentDashboard

**Edit:** `src/pages/StudentDashboard.tsx`
- Replace the "attendance" tab with a "schedule" tab
- Render `StudentScheduleCalendar` in the schedule tab
- Remove the old `AttendanceHeatmap` import (replaced by the new component)

### 4. Route update

**Edit:** `src/App.tsx`
- No route changes needed; the `/schedule` route still exists for admin/teacher. Students access via dashboard tab.

### 5. Kid-Friendly UX Additions

- **Day cell indicators:** Small emoji dots (📝 for homework due, ✅ for attended, ⭐ for XP earned)
- **"Today" highlight:** Extra-large pulsing ring with "TODAY!" label
- **Empty state:** Friendly mascot saying "No classes this day! Time to play! 🎮"
- **Streak celebration:** When streak >= 5, show fire animation 🔥
- **Color legend:** Kid-friendly with emoji + simple words ("I was there! ✅", "Class coming! 🔵")

### Technical Details

**Data model (single useQuery):**
```text
sessions → class name, teacher, time, status
attendance → student present/absent per session
point_transactions → XP by date + category
homeworks → title, due_date, class_id (for enrolled classes)
homework_submissions → student's submission status per homework
```

**Component structure:**
```text
StudentScheduleCalendar
├── Header (streak stats + month picker)
├── Calendar Grid (7-col, large cells)
│   └── Day Cell → Popover on click
│       ├── Past: attendance + XP + homework status
│       └── Future: schedule + teacher + homework due
├── Legend (emoji-based, kid-friendly)
└── XP Trend Chart (recharts LineChart)
```

**Files to create:**
- `src/components/student/StudentScheduleCalendar.tsx`

**Files to edit:**
- `src/components/student/StudentNavBar.tsx` -- remove "Attendance" item, update "Schedule" path
- `src/pages/StudentDashboard.tsx` -- replace attendance tab with schedule tab using new component

