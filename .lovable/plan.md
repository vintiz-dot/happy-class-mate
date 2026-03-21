## Plan: Multi-Feature Enhancement

This request contains 9 distinct features. Here is the implementation plan organized by priority and complexity.

---

### 1. Fix Duplicate Students in Homework Offline Grading

**Problem**: The enrollment query in `GradeOfflineDialog.tsx` (line 59-62) fetches enrollments without filtering `end_date IS NULL`, so students with multiple enrollments (past + active) appear multiple times.

**Fix**: 

- Add `.is("end_date", null)` to the enrollments query
- Deduplicate results by `student_id` using a `Map` before setting state
- Apply the same deduplication pattern across all enrollment-based student lists (search for similar patterns in `HomeworkGrading.tsx`, `HomeworkGradingList.tsx`, `AttendanceMarking.tsx`, `LiveAssessmentGrid.tsx`)

---

### 2. Enroll Student from Admin Student Profile

**Problem**: Admin must navigate to the class page to enroll a student. The `StudentEnrollmentsTab` only shows existing enrollments with no "Add" action.

**Fix**:

- Add an "Enroll in Class" button to `StudentEnrollmentsTab.tsx`
- Create a simple modal/dialog with a class picker (active classes not already enrolled), start date field, and confirm button
- Inserts directly into the `enrollments` table

---

### 3. Centralized School-Wide Past Calendar

**Problem**: The existing `Schedule` page (`GlobalCalendar`) shows all classes in one calendar but only for the current month context. Admin needs a dedicated way to browse past months across all classes.

**Fix**:

- The `GlobalCalendar` component already supports month navigation via the `PremiumCalendar` component. Verify it correctly loads past months' sessions (it queries by `month.startOf/endOf`).
- If month navigation is already functional, no changes needed. If not, ensure the month picker in PremiumCalendar allows backward navigation without restrictions.
- Add a "School Calendar" link in the admin sidebar if not already present, pointing to `/schedule`.

---

### 4. Cancelled Sessions → Attendance = Excused

**Problem**: When a session is cancelled, student attendance remains "Present" instead of being switched to "Excused". No need to change the tuition calculation function as it correctly ignores cancelled classes.

**Fix**:

- Create a database trigger: when `sessions.status` is updated to `'Canceled'`, automatically update all related `attendance` rows to `status = 'Excused'`.
- Migration SQL:
  ```sql
  CREATE OR REPLACE FUNCTION set_attendance_excused_on_cancel()
  RETURNS trigger AS $$
  BEGIN
    IF NEW.status = 'Canceled' AND OLD.status != 'Canceled' THEN
      UPDATE attendance SET status = 'Excused'
      WHERE session_id = NEW.id AND status = 'Present';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER trg_cancel_session_excused
  AFTER UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_attendance_excused_on_cancel();
  ```

---

### 5. Smart Tuition Difference Flagging

**Problem**: When a student's final payable differs from base tuition (due to cancelled sessions, discounts, excused absences), there's no explanation.

**Fix**:

- Enhance the tuition display components (`TuitionStudentCard.tsx`, `StudentTuitionTab.tsx`) to show a breakdown tooltip/expandable section
- Pull data from the `calculate-tuition` edge function response (which already returns session counts, cancelled counts, discount info)
- Display flags like: "2 sessions cancelled (-420,000₫)", "Sibling discount 10% (-42,000₫)", "1 excused absence (-210,000₫)" also include the dates of the cancelled or excussed classes with reasons if possible.
- Use color-coded badges: green for credits, orange for adjustments

---

### 6. Class Metadata Fields (Curriculum, Age Range, etc.)

**Database Migration**: Add new columns to the `classes` table:

```sql
ALTER TABLE classes ADD COLUMN curriculum text;
ALTER TABLE classes ADD COLUMN age_range text;
ALTER TABLE classes ADD COLUMN description text;
ALTER TABLE classes ADD COLUMN max_students integer;
ALTER TABLE classes ADD COLUMN visibility_settings jsonb DEFAULT '{"curriculum": true, "age_range": true, "description": true, "teacher_info": true}'::jsonb;
```

**UI Changes**:

- **ClassSettings.tsx**: Add input fields for curriculum, age range, description, max students
- **ClassSettings.tsx**: Add toggle switches for each field's public visibility (`visibility_settings` JSON)
- **ClassForm.tsx**: Add optional fields during class creation

---

### 7. Class Info Display for Students

**Fix**:

- **ClassCatalog.tsx** (new/demo students): Show curriculum, age range, description, teacher bio based on `visibility_settings`
- **StudentEnrollmentsTab / StudentOverviewTab**: For enrolled students, show their class info (curriculum, schedule, teacher name/bio) in a card
- **Student Dashboard**: Show class details card for each enrolled class

---

### 8. Privacy Toggles in Class Settings

Already covered in item 6 — the `visibility_settings` JSONB column with toggle UI in ClassSettings.

---

### 9. Teacher Info Visibility

**Fix**:

- **For enrolled students**: Show teacher name and basic info on their class cards (already partially done via enrollment queries)
- **For new/prospective students**: Create a "Meet Our Teachers" section in the demo dashboard or class catalog, fetching from `teachers` table (name, bio fields)
- **Teacher bio**: Check if `teachers` table has a bio column. If not, add one via migration.

---

### Implementation Order

1. **Database migration** — Add class metadata columns, teacher bio column, cancel→excused trigger (single migration)
2. **Fix duplicates** — Quick query fixes across grading/attendance components
3. **Enroll from profile** — New dialog in StudentEnrollmentsTab
4. **Class settings UI** — Add new fields and visibility toggles
5. **Tuition flagging** — Enhance tuition display with breakdown explanations
6. **Student-facing class info** — Update ClassCatalog and student views
7. **Teacher info** — Add teacher showcase for prospective students
8. **Calendar verification** — Ensure past month navigation works school-wide

### Technical Details

- **Files to create**: ~2 new components (EnrollStudentDialog, TuitionBreakdownFlags)
- **Files to modify**: ~10 existing files
- **Database changes**: 1 migration (new columns + trigger)
- **No new edge functions needed** — all changes use existing client-side queries and the existing `calculate-tuition` response data