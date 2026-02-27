

# Unified Session Management UX

## Problem
Two disconnected flows exist:
- **Admin Schedule page** → `AttendanceDrawer` → `SessionActionsModal` → `EditSessionModal` — can mark attendance but **cannot change teacher** (edit only has time/notes)
- **Class Detail calendar** → `SessionDrawer`/`EditSessionModal` (class version) — **can change teacher** but **cannot mark attendance**

Admin must navigate between pages to do basic session management.

## Solution
Unify both flows so every session interaction point gives full access to all actions.

### 1. Add teacher selector to admin `EditSessionModal`
**File: `src/components/admin/EditSessionModal.tsx`**
- Add a teacher `Select` dropdown (fetch active teachers via query, same pattern as class-level `EditSessionModal`)
- Include `teacher_id` in the update payload and audit log diff
- Pre-populate with current `session.teacher_id`

### 2. Add attendance marking to class-specific calendar
**File: `src/components/admin/class/ClassCalendarEnhanced.tsx`**
- Import `AttendanceDrawer`
- When admin clicks a session, open `AttendanceDrawer` instead of the read-only `SessionDrawer`
- Keep the existing edit modal accessible via the "Session Actions" button inside the attendance drawer

### 3. Clean up GlobalCalendar admin flow
**File: `src/components/schedule/GlobalCalendar.tsx`**
- For admin role, the `AttendanceDrawer` already opens (correct). No changes needed here — once `EditSessionModal` gains teacher editing, the full flow works from the dashboard calendar.

## Files Changed

| Action | File |
|--------|------|
| Modified | `src/components/admin/EditSessionModal.tsx` — add teacher selector |
| Modified | `src/components/admin/class/ClassCalendarEnhanced.tsx` — use AttendanceDrawer for admin |

