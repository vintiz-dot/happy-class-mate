

# Render Full HTML in Splash Announcements

## Problem

The current `sanitizeHtml` function strips out nearly everything your Tet HTML needs: `<style>` tags, inline `style` attributes, `<img>`, SVG elements, CSS animations, Google Fonts links, and custom classes. The result would be plain unstyled text.

## Solution: Sandboxed iframe with `srcdoc`

Instead of trying to expand the sanitizer to allow dozens of tags/attributes (which weakens security for all announcement types), use a **sandboxed iframe** specifically for splash HTML bodies. This:

- Renders the complete HTML document exactly as designed (fonts, animations, SVGs, CSS)
- Keeps it secure via the `sandbox` attribute (blocks scripts, form submissions, popups)
- Isolates the announcement styles from the app's styles
- Requires zero changes to the sanitizer used by other announcement types

## Technical Details

### File: `src/components/announcements/SplashAnnouncement.tsx`

Replace the `dangerouslySetInnerHTML` div with a sandboxed iframe when `announcement.body` is present:

```tsx
{announcement.body ? (
  <iframe
    srcDoc={announcement.body}
    sandbox="allow-same-origin"
    className="w-full h-full border-0"
    title="Announcement content"
    style={{ colorScheme: "normal" }}
  />
) : /* ... existing image/title fallback ... */}
```

Key details:
- `sandbox="allow-same-origin"` -- blocks scripts, form submissions, and popups while allowing CSS/fonts to render
- The iframe fills the scrollable area (`flex-1`) between the top and the fixed Continue button
- The X button and Continue button remain fixed overlays on top, unaffected by iframe content
- No changes needed to `sanitize.ts` -- the restrictive sanitizer stays intact for banner, popup, toast, etc.

### Files Changed

| File | Change |
|------|--------|
| `src/components/announcements/SplashAnnouncement.tsx` | Replace `dangerouslySetInnerHTML` with sandboxed `<iframe srcDoc>` for body content |

No other files need modification.

