

## Plan: Fix homework overflow + make download button obvious

Surgical fixes — no rebuild needed. The root cause is link/URL overflow plus an under-emphasized download control. Both are fixable in 4 files with no behavior changes.

---

### 1. Kill horizontal overflow everywhere rich content renders

**`src/index.css` — global rule for links inside rich content:**

Add to the existing `.prose a, .rich-content a` block:
```css
overflow-wrap: anywhere;
word-break: break-word;
display: inline;       /* ensure wrap respects flow */
max-width: 100%;
```
And add a sibling rule to harden the rich-content container itself so any element inside (long URLs in `<p>`, `<li>`, `<code>`) wraps:
```css
.rich-content, .prose { overflow-wrap: anywhere; word-break: break-word; }
.rich-content *, .prose * { max-width: 100%; }
.rich-content pre, .prose pre { white-space: pre-wrap; }
```

This single change fixes overflow in **every** place rich HTML is rendered (homework detail, card preview, exam reports, announcements) — not just the homework page.

---

### 2. Lock the assignment card to the viewport width

**`src/pages/StudentAssignments.tsx` — `AssignmentCard`:**

- Add `min-w-0` and `overflow-hidden` to the outer `Card` so flex children can never push it wider than the screen.
- Add `min-w-0 break-words` to the title's flex-1 wrapper (the URL was inside a flex parent without `min-w-0` — the classic flexbox overflow trap).
- Wrap the body preview in a `min-w-0 overflow-hidden` div and replace `line-clamp-2` with the same wrap rules used in the dialog (`[overflow-wrap:anywhere] break-words`) so long URLs wrap to 2 lines instead of overflowing.
- Apply `min-w-0` to the page-level grid wrappers (`grid gap-3` containers) and the `Layout` content area is already constrained, so this stops cascading overflow.

---

### 3. Make the download button unmistakable

Two changes:

**On the assignment list cards (`AssignmentCard`):**
- Replace the tiny `variant="icon"` PDF button with a clearly labeled pill: blue/violet background, `Download` icon + "PDF" label, ~36px tall. Sits on its own row below the badges so it never gets shoved off-screen by long titles.
- On mobile (`<sm:`) it goes full-width-ish with text "Download PDF"; on desktop it stays as a compact pill with "PDF".

**Inside the detail dialog (`HomeworkDetailDialog`):**
- Promote the icon-only download in the meta row to a proper button: outline style, `Download` icon + "Download as PDF" label, placed in its own full-width row directly under the title metadata. Sticky on mobile? No — keep it inline so it scrolls naturally, but make sure it's above the fold.

**Teacher/admin homework views (`HomeworkGradingList`, `AssignmentUpload` lists):**
- Same treatment: convert the tiny icon to a labeled button "PDF" with the download icon, ~40px tall touch target.

---

### 4. One last safety net

**`src/index.css`:**
Add a utility class `.no-x-overflow` that applies `overflow-x: hidden; max-width: 100vw;` and apply it to the homework page root container and the dialog/sheet content roots. This guarantees that even if a future edge case slips through, the user can never need to pinch-zoom horizontally.

---

### Files touched
- `src/index.css` — link wrap rules + container safety net
- `src/pages/StudentAssignments.tsx` — card overflow fix + prominent PDF button
- `src/components/student/HomeworkDetailDialog.tsx` — labeled download button
- `src/components/teacher/HomeworkGradingList.tsx` + `src/components/teacher/AssignmentUpload.tsx` — labeled PDF buttons

### Out of scope
- No data, RLS, or schema changes
- No rich-text editor changes
- No layout redesign — same components, just bulletproof against long URLs and a much more visible download control

