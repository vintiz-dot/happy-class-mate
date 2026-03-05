

# Premium EdTech Homework View Upgrade

## What's Changing

### 1. Explicit Color-Coded Status System (all 3 files)

Replace the current muted/translucent status colors with vivid, unmistakable color codes:

| Status | Color | Code |
|--------|-------|------|
| Overdue (not submitted) | **Hot Red** | `bg-red-500/25 border-red-500 text-red-700` |
| Due today/tomorrow | **Amber** | `bg-amber-500/20 border-amber-500 text-amber-700` |
| Submitted (pending grade) | **Sky Blue** | `bg-sky-500/15 border-sky-400 text-sky-700` |
| Graded | **Emerald Green** | `bg-emerald-500/15 border-emerald-500 text-emerald-700` |
| Future (no urgency) | Default glass | — |

Apply consistently across `StudentAssignments.tsx`, `AssignmentsList.tsx`, and `HomeworkDetailDialog.tsx`.

### 2. Premium Card Redesign — `StudentAssignments.tsx`

- Add a colored **left border strip** (4px) matching status color for instant visual scanning
- Add a **status icon** (🔴 overdue, 🟡 due soon, 🔵 submitted, ✅ graded) in the card header
- Show a **progress indicator** in the card: "Submitted → Awaiting Grade → Graded" as a mini step indicator for submitted items
- Add a compact **countdown timer** directly on the card (e.g., "2d 5h left" or "3 days overdue") with color matching
- Make the grade badge larger and more celebratory when graded (bigger font, star icon)

### 3. Premium Detail Dialog — `HomeworkDetailDialog.tsx`

- Add a **status banner** at the top of the dialog with full-width color strip and status text
- Add a **difficulty/priority indicator** based on days until due
- Improve the graded view: show grade in a large circular badge with a ring (like a score), not just text
- Add subtle **confetti-style dots** background pattern on the graded section
- Improve file attachment cards with file type icons and size display

### 4. Enhanced Submission View — `HomeworkSubmission.tsx`

- Wrap the graded feedback section in a premium card with gradient header
- Make the grade display a large centered circular badge
- Add a "submission timeline" showing: Created → Submitted → Graded with timestamps
- Style the teacher feedback bubble more prominently with an avatar placeholder

### 5. AssignmentsList.tsx — Sync Colors

Update `getCardStatusClass` to use the same vivid color system.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/StudentAssignments.tsx` | Status colors, left border strip, countdown, grade celebration, status icons |
| `src/components/student/AssignmentsList.tsx` | Sync status colors to match |
| `src/components/student/HomeworkDetailDialog.tsx` | Status banner, grade circle badge, priority indicator |
| `src/components/student/HomeworkSubmission.tsx` | Grade circle badge, submission timeline, premium feedback styling |

No database changes. No new dependencies.

