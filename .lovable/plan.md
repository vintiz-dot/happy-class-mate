

## Problem

The homework body content still allows horizontal scrolling despite `break-words` and `overflow-hidden`. The screenshot shows text extending beyond the viewport. The likely cause is that `overflow-hidden` on the prose div doesn't prevent the parent or the dialog content itself from scrolling horizontally. Additionally, `word-break: break-word` (from Tailwind's `break-words`) doesn't catch all cases — long unbroken strings or certain inline elements can still overflow.

## Fix

On the prose div (line 113), add `overflow-wrap: anywhere` and `word-break: break-all` as fallback, plus ensure the container itself has `overflow-x-hidden` and a constrained width. Also add `w-full min-w-0` to force the container to respect its parent's width.

### File: `src/components/student/HomeworkDetailDialog.tsx`

1. **Line 108** — Add `overflow-hidden` to the instruction wrapper div
2. **Line 113** — Add `w-full min-w-0 overflow-x-hidden` to the prose div, and add `[&_*]:max-w-full [&_*]:overflow-wrap-anywhere` to catch all child elements
3. **Line 62** — Add `overflow-hidden` to the `DialogContent` className to prevent any horizontal scroll at the dialog level

