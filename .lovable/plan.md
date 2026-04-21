

## Plan: Homework links + targeted mobile/perf pass

Three workstreams, ordered low-risk → high-impact. No visual redesign, no schema changes, no breaking changes to existing flows.

---

### 1. Homework links — visible in app, clickable in PDF

**In-app rendering (`HomeworkDetailDialog` and assignment cards):**
- Update the `prose` block so `<a>` tags render as **bold blue (#2563eb), underlined, with a hover color shift and an external-link icon** appended via CSS `::after`. Apply the same styling to teacher/admin homework views.
- Add `target="_blank" rel="noopener noreferrer"` to all rendered links via a small post-sanitize transform (DOMPurify hook), so taps open in a new tab.

**PDF generation (`HomeworkPdfDownload.tsx`) — switch from "image of HTML" to real text + links:**
- Replace the current `html2canvas → image → jsPDF.addImage` approach (which flattens everything into a non-clickable image) with **`jsPDF.html()`** which preserves selectable text and clickable `<a href>` annotations.
- In the HTML template, style links as **blue underlined** and append the full URL in parentheses next to each link's visible text (so printed copies still show the URL). A small DOM walk before render does this transformation.
- Keep the existing branded header (logo, Happy English Club, teacher/class/due date table) and 15mm margins; jsPDF.html handles pagination natively.
- Fallback: if `jsPDF.html()` fails for a given body, fall back to the current canvas method so downloads never break.

---

### 2. Performance — navigation, interactions, heavy pages

**Route-level code splitting (biggest single win for nav speed + initial load):**
- Convert all route imports in `src/App.tsx` to `React.lazy()`. Currently every page (Admin, Teacher*, Student*, Schedule, Tuition, exam reports, journals, etc.) is bundled into the initial JS payload. Lazy-loading shrinks first paint and makes route transitions load only what's needed.
- The existing `<Suspense fallback={<AppLoader />}>` already wraps `<Routes>`, so no new boilerplate is needed.

**React Query tuning (fewer redundant fetches, snappier re-opens):**
- Add `staleTime: 60_000` and `gcTime: 5 * 60_000` to the default `QueryClient` options so navigating back to a page doesn't refetch everything immediately.
- Keep `refetchOnWindowFocus: false` (already set).

**Heavy-page targeted fixes:**
- **Student dashboard / homework list**: lazy-load `HomeworkDetailDialog` (already lazy for submission — extend to dialog itself when opened from list), memoize the assignment-row component with `React.memo`, and virtualize only if list > 50 items (use a lightweight windowing approach with CSS `content-visibility: auto` first — no new dep).
- **Teacher leaderboards**: wrap the per-student row in `React.memo` keyed by student id + score, so a single point update doesn't re-render the whole grid.
- **Dialogs/sheets opening slowly**: the rich-text editor is the main culprit and is already lazy — extend the same pattern to the exam-report editor and any other dialog that imports `react-quill-new` eagerly.

**Bundle hygiene:**
- Audit `src/components/announcements/AnnouncementRenderer` and other always-mounted components for heavy imports; move non-critical work behind `requestIdleCallback` where safe.

---

### 3. Targeted mobile pass (no redesign)

Page-by-page audit at 375px width fixing only stability/usability bugs:

- **Touch targets**: ensure every interactive element is ≥40px tall on mobile (buttons, table row actions, nav links). Bump `size="sm"` buttons to default size on `sm:` and below where they're primary actions.
- **Horizontal overflow**: scan dashboards, leaderboards, tuition, finance tables for elements that force horizontal scroll. Wrap wide tables in `overflow-x-auto` containers with sticky first column where useful (tuition, payroll).
- **Sticky headers/nav**: verify `StudentNavBar` and admin tab bars don't cover content under iOS safe-area; add `pb-[env(safe-area-inset-bottom)]` where appropriate.
- **Dialogs on mobile**: convert oversized `Dialog` components on small screens to `Sheet` (bottom sheet) for: AddSession, EditSession, FamilyPayment, AttendanceDrawer, HomeworkDetailDialog. Existing desktop behavior preserved via responsive switch.
- **Inputs**: set `inputMode` and `autoComplete` correctly on phone, money, and email inputs to surface the right mobile keyboard.
- **Long lists**: add `content-visibility: auto` to large list items (homework, students, sessions) for smoother scroll.

---

### Files touched (high level)

- `src/lib/sanitize.ts` — keep target/rel attrs on `<a>`
- `src/components/homework/HomeworkPdfDownload.tsx` — switch to `jsPDF.html()`, link transform
- `src/components/student/HomeworkDetailDialog.tsx`, `src/pages/StudentAssignments.tsx`, teacher/admin homework lists — link styling utility class
- `src/index.css` — global `.rich-content a` link style + external-link icon
- `src/App.tsx` — `React.lazy` for all routes, query client tuning
- Per-page mobile fixes across student/teacher/admin dashboards, dialogs → sheets on mobile
- `React.memo` on leaderboard rows and homework list items

### Out of scope (call out for follow-up if needed)

- No DB/RLS changes
- No edge-function changes
- No visual redesign — same look, just stable on mobile and faster
- Capacitor/native wrap not included (separate decision)

