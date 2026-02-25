

## Problem

The current attendance heatmap shows 6 months of tiny dots spanning horizontally -- hard to read, especially on mobile. There's no way to filter by month and no XP trend visualization.

## Plan

### 1. Redesign AttendanceHeatmap with Month Picker + Calendar Grid

**Replace the GitHub-style multi-month heatmap** with a single-month calendar view controlled by the existing `MonthPicker` component.

- Add `useState` for `selectedMonth` (defaults to current month `YYYY-MM`)
- Render `MonthPicker` at the top for easy month navigation
- Build a proper 7-column calendar grid for the selected month (Mon-Sun headers, day numbers visible)
- Each day cell is color-coded by attendance intensity (same green scale) and clickable to show the popover with session details and points breakdown
- Keep the streak stats row (current streak + longest streak) above the calendar
- Query data scoped to the selected month only (more efficient)

### 2. Add XP Points Trend Line Chart

Below the calendar, add a `recharts` `LineChart` showing daily XP earned throughout the selected month.

- X-axis: days of the month
- Y-axis: XP points
- Single line showing cumulative or daily XP
- Use the `point_transactions` data already fetched, aggregated by date
- Styled with the existing theme colors (primary gradient)

### 3. Update the Attendance Tab wrapper

In `StudentDashboard.tsx`, no structural changes needed -- the `AttendanceHeatmap` component handles everything internally.

### Technical Details

**Files to edit:**
- `src/components/student/AttendanceHeatmap.tsx` -- full rewrite of the rendering logic:
  - Import `MonthPicker` and `useState`
  - Import `LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer` from recharts
  - Change data query to use `selectedMonth` start/end dates instead of `months` prop range
  - Replace the horizontal dot grid with a 7-column calendar grid showing day numbers
  - Add a `ResponsiveContainer` + `LineChart` below the calendar for XP trend
  - Keep the popover interaction for day details

**No database changes needed** -- uses existing `sessions`, `attendance`, and `point_transactions` tables.

**Existing components reused:**
- `MonthPicker` for month selection
- `Popover` for day detail popups
- `recharts` for the trend line (already installed)

