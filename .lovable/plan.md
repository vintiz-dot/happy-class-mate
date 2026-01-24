
# Plan: Fix Popover Positioning and Update Teacher/Admin Hover Effects

## Overview
This plan addresses two key issues: (1) fixing the popover modal positioning in the live assessment grid to prevent overlap with student cards during bulk selection, and (2) updating all hover effects for teacher and admin interfaces to use a premium royal green text with warm gray background theme.

---

## Part 1: Fix Popover Modal Positioning in Live Assessment Grid

### Problem
When teachers click on a student card in bulk mode, the skill selection popover appears on top of adjacent student cards, making it impossible to select those students. The popover currently uses `side="top"` which can cause overlap in a dense grid layout.

### Solution
1. **Change popover positioning strategy** in `LiveAssessmentGrid.tsx`:
   - Use `side="right"` or `side="left"` instead of `side="top"` to prevent vertical overlap
   - Add `collisionPadding` to ensure the popover stays within viewport bounds
   - Enable `avoidCollisions={true}` (default) with proper `collisionBoundary` settings
   - Add `sideOffset` and `alignOffset` for better spacing

2. **Update the PopoverContent component** to support collision-aware positioning by passing through collision props properly

### Files to Modify
- `src/components/teacher/LiveAssessmentGrid.tsx`
- `src/components/ui/popover.tsx` (enhance collision handling)

### Technical Details
```text
PopoverContent changes:
- side: "right" (prefers right, falls back on collision)
- sideOffset: 12 (more spacing from trigger)
- align: "start" (aligns to top of trigger)
- collisionPadding: 16 (buffer from viewport edges)
```

---

## Part 2: Update Hover Effects to Royal Green + Warm Gray Theme

### Problem
Current hover effects use purple/accent colors that don't match the requested premium theme of "royal green text with warm gray background".

### Color Palette Definition
- **Royal Green**: `hsl(152, 69%, 31%)` - A rich, deep green (#1B7340)
- **Warm Gray Background**: `hsl(30, 10%, 94%)` - A subtle warm gray (#F2F0ED)
- **Dark Mode Warm Gray**: `hsl(30, 5%, 20%)` - Darker warm gray for dark mode

### Files to Modify

1. **`src/index.css`**
   - Add new CSS custom properties for royal green and warm gray
   - Create new utility class `.premium-hover` for consistent hover styling
   - Update `.nav-hover-red` to `.nav-hover-premium` with the new colors

2. **`src/components/ui/button.tsx`**
   - Update ghost and outline variant hover states to use new premium colors

3. **`src/components/ui/dropdown-menu.tsx`**
   - Update `DropdownMenuItem` hover state: `hover:bg-warmGray hover:text-royalGreen`
   - Update `DropdownMenuSubTrigger` hover state

4. **`src/components/ui/select.tsx`**
   - Update `SelectItem` focus/hover state to match new theme

5. **`src/components/Layout.tsx`**
   - Update sidebar navigation hover states from purple to royal green
   - Update mobile menu hover states
   - Change `group-hover:text-purple-600` to `group-hover:text-emerald-700`

6. **`src/components/teacher/LiveAssessmentGrid.tsx`**
   - Update student card hover state: `hover:bg-accent/50` to warm gray
   
7. **`src/components/teacher/SkillButton.tsx`**
   - Update point selection button hover states

8. **`src/components/teacher/RadialSkillMenu.tsx`**
   - Update skill/behavior button hover states

---

## Implementation Sequence

### Phase 1: CSS Foundation
1. Add color variables to `tailwind.config.ts` for `royalGreen` and `warmGray`
2. Add utility classes in `src/index.css`:
   ```css
   .premium-hover {
     @apply transition-all duration-200;
   }
   .premium-hover:hover {
     background-color: hsl(30, 10%, 94%) !important;
     color: hsl(152, 69%, 31%) !important;
   }
   .dark .premium-hover:hover {
     background-color: hsl(30, 5%, 20%) !important;
     color: hsl(152, 55%, 45%) !important;
   }
   ```

### Phase 2: Fix Popover Positioning
1. Update `PopoverContent` in `src/components/ui/popover.tsx` to accept and pass collision props
2. Modify `LiveAssessmentGrid.tsx` popover to use `side="right"` with proper offsets

### Phase 3: Update UI Components
1. Update `button.tsx` ghost/outline variants
2. Update `dropdown-menu.tsx` item hover styles
3. Update `select.tsx` item focus styles

### Phase 4: Update Layout and Navigation
1. Update `Layout.tsx` sidebar hover states
2. Replace all `group-hover:text-purple-600` with royal green

### Phase 5: Update Teacher-Specific Components
1. Update `LiveAssessmentGrid.tsx` card hover
2. Update `SkillButton.tsx` hover states
3. Update `RadialSkillMenu.tsx` button hover states

---

## Visual Summary

```text
Before:
- Hover: purple-600 text, accent/50 background
- Popover: appears on top, overlaps cards

After:
- Hover: emerald-700/royalGreen text, warmGray background
- Popover: appears to the side, avoids card overlap
- High contrast between text (#1B7340) and background (#F2F0ED)
```

---

## Testing Checklist
- [ ] Verify popover does not overlap student cards in bulk mode
- [ ] Confirm popover repositions correctly on screen edges
- [ ] Check all button hover states show royal green text
- [ ] Verify warm gray background is visible on hover
- [ ] Test dark mode hover colors for proper contrast
- [ ] Verify navigation sidebar hover states are consistent
- [ ] Test mobile menu hover states
- [ ] Confirm dropdown menus show new hover theme
