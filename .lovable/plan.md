

# Fix: Announcement Image Loading Speed + Splash Image Fullscreen

## Problems

1. **Images load slowly** -- All announcement images use `loading="lazy"`, which delays rendering since the browser defers fetching. For notifications that should appear instantly, this is counterproductive.
2. **Splash image is too small** -- Currently capped at `max-h-64` inside a `max-w-2xl` container. For a full-screen splash/flashing notification, the image should fill 95% of the viewport.

## Changes

### 1. Remove `loading="lazy"` from all announcement images (6 files)

Since announcements are above-the-fold, critical UI elements, lazy loading actively harms perceived performance. Change to `loading="eager"` (or simply remove the attribute) across all components.

| File | Line |
|------|------|
| `SplashAnnouncement.tsx` | Line 53 |
| `PopupAnnouncement.tsx` | Line 46 |
| `BannerAnnouncement.tsx` | Line 32 |
| `ToastAnnouncement.tsx` | Line 27 |
| `FooterBarAnnouncement.tsx` | Line 27 |
| `StickyHeaderAnnouncement.tsx` | (no image, skip) |

Additionally, add `fetchPriority="high"` to splash and popup images to tell the browser to prioritize them.

### 2. Make Splash image fill 95% of viewport

Update `SplashAnnouncement.tsx`:

- Remove the `max-w-2xl` constraint on the inner container
- Change image classes from `max-h-64 rounded-2xl object-contain` to `w-[95vw] h-[95vh] object-contain` so the image fills 95% of the viewport
- When there's an image, reduce text/title prominence so the image dominates
- Keep the dismiss button and countdown overlay

**Before:**
```tsx
<motion.div className="max-w-2xl w-full text-center space-y-6">
  <img className="mx-auto max-h-64 rounded-2xl object-contain" loading="lazy" />
```

**After:**
```tsx
<motion.div className="w-full h-full flex flex-col items-center justify-center gap-4 px-2">
  <img className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl" loading="eager" fetchPriority="high" />
```

The image gets 85vh (leaving room for title/button), or if there's no title/body, it gets the full 95vh.

### 3. Add image preloading in AnnouncementRenderer

Add a preload mechanism: when announcements are fetched, immediately create `<link rel="preload">` tags for any image URLs. This starts the download before the component even mounts.

```tsx
// In AnnouncementRenderer.tsx
useEffect(() => {
  announcements.forEach((a) => {
    if (a.image_url && !document.querySelector(`link[href="${a.image_url}"]`)) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = a.image_url;
      document.head.appendChild(link);
    }
  });
}, [announcements]);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/announcements/SplashAnnouncement.tsx` | 95vw/85vh image, eager loading, fetchPriority |
| `src/components/announcements/PopupAnnouncement.tsx` | Remove lazy, add eager + fetchPriority |
| `src/components/announcements/BannerAnnouncement.tsx` | Remove lazy, add eager |
| `src/components/announcements/ToastAnnouncement.tsx` | Remove lazy, add eager |
| `src/components/announcements/FooterBarAnnouncement.tsx` | Remove lazy, add eager |
| `src/components/announcements/AnnouncementRenderer.tsx` | Add image preload effect |

