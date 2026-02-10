

# Site-Wide Admin Notification System

## Overview

A powerful announcement system where admins can create and manage rich notifications displayed across the platform. Supports multiple display formats (banner, popup, toast, sticky header, footer bar, full-screen splash), audience targeting, scheduling, and responsive design.

## Database Schema

### New Table: `site_announcements`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Short title for admin reference |
| `body` | text | Main text content (supports basic HTML) |
| `image_url` | text (nullable) | Optional image (stored in a new `announcements` storage bucket) |
| `display_type` | text | One of: `banner`, `popup`, `sticky_header`, `footer_bar`, `splash`, `toast` |
| `priority` | int | Ordering priority (higher = shown first) |
| `target_audience` | text | One of: `everyone`, `authenticated`, `students`, `teachers`, `families`, `paying_students` |
| `placement` | text | Where it shows: `before_login`, `after_login`, `both` |
| `starts_at` | timestamptz (nullable) | When to start showing (null = immediately) |
| `expires_at` | timestamptz (nullable) | When to stop showing (null = until disabled) |
| `is_active` | boolean | Admin toggle to enable/disable |
| `is_dismissible` | boolean | Whether users can close it |
| `style_config` | jsonb | Colors, animation type, etc. (e.g. `{"bg": "#ff0000", "text": "#fff", "animation": "pulse"}`) |
| `created_by` | uuid | Admin who created it |
| `created_at` | timestamptz | Auto-generated |
| `updated_at` | timestamptz | Auto-generated |

### New Table: `announcement_dismissals`

Tracks which users dismissed which announcements (for dismissible ones).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `announcement_id` | uuid (FK) | References `site_announcements` |
| `user_id` | uuid | The user who dismissed |
| `dismissed_at` | timestamptz | When dismissed |

### RLS Policies

- **site_announcements**: Admin full CRUD; all authenticated users can SELECT active announcements; anonymous users can SELECT announcements where `placement = 'before_login'` or `target_audience = 'everyone'`
- **announcement_dismissals**: Users can INSERT/SELECT their own dismissals only; admins can SELECT all

### Storage Bucket

- New `announcements` bucket (public) for announcement images

## Display Types

| Type | Behavior |
|------|----------|
| **Banner** | Full-width colored strip at top/bottom of page, auto-adjusts for content length |
| **Popup** | Centered modal overlay with backdrop blur, image support, close button |
| **Sticky Header** | Thin persistent bar pinned to top of viewport, above all other content |
| **Footer Bar** | Fixed bar at bottom of viewport |
| **Splash** | Full-screen overlay shown before page content loads (for critical announcements) |
| **Toast** | Auto-appearing toast notification in corner |

## Target Audience Logic

| Target | Filter Logic |
|--------|-------------|
| `everyone` | No auth required, shown on public pages |
| `authenticated` | Any logged-in user |
| `students` | User has `student` role |
| `teachers` | User has `teacher` role |
| `families` | User has `family` role |
| `paying_students` | Student with positive tuition balance (checked via enrollment status) |

## New Files

### 1. `src/components/announcements/AnnouncementRenderer.tsx`
- Global component placed in `App.tsx` (inside `BrowserRouter` so it has access to route/auth context)
- Fetches active announcements via react-query
- Filters by audience, placement, timing, and dismissal status
- Renders the appropriate display component for each announcement
- Uses framer-motion for entrance/exit animations

### 2. `src/components/announcements/BannerAnnouncement.tsx`
- Full-width animated banner with gradient backgrounds
- Supports image alongside text
- Dismiss button (X) if `is_dismissible`
- Responsive: stacks vertically on mobile

### 3. `src/components/announcements/PopupAnnouncement.tsx`
- Centered dialog/modal with backdrop blur
- Supports large images, rich text body
- CTA button optional
- Animations: scale-in with spring physics

### 4. `src/components/announcements/StickyHeaderAnnouncement.tsx`
- Thin bar fixed to top, scrolls with marquee if text is long
- Pulsing/flashing animation option via `style_config`

### 5. `src/components/announcements/FooterBarAnnouncement.tsx`
- Fixed bottom bar, similar to cookie consent patterns

### 6. `src/components/announcements/SplashAnnouncement.tsx`
- Full-screen overlay with fade-in
- Auto-dismiss timer or manual close
- Used for critical school-wide announcements

### 7. `src/hooks/useAnnouncements.ts`
- Custom hook to fetch, filter, and manage announcement state
- Handles dismissal logic (writes to `announcement_dismissals`)
- Checks audience eligibility (role, tuition status)
- Time-based filtering (starts_at / expires_at)

### 8. `src/components/admin/AnnouncementManager.tsx`
- Admin CRUD interface for managing announcements
- Form with: title, body (rich text), image upload, display type selector, audience picker, placement selector, date range pickers, style customization (color pickers, animation toggles)
- Live preview of how the announcement will look
- List of existing announcements with status toggles, edit, delete
- Shows active/expired/scheduled status badges

## Modified Files

### `src/App.tsx`
- Add `<AnnouncementRenderer />` inside the `BrowserRouter` / `StudentProfileProvider` tree

### `src/components/admin/tabs/OverviewTab.tsx`
- Add an "Announcements" quick-action card linking to the manager

### `src/components/Layout.tsx`
- No changes needed; announcements render independently via portal/fixed positioning

### Admin Navigation (`Layout.tsx`)
- Add a new nav item: "Announcements" under admin sidebar (using `Megaphone` icon)

## Technical Details

### Animation System
- Uses `framer-motion` `AnimatePresence` for smooth mount/unmount
- Banner: slide-down from top
- Popup: scale + fade with spring
- Sticky: slide-down
- Splash: full fade with blur transition
- Flashing effect via CSS `@keyframes` with configurable speed in `style_config`

### Responsive Design
- All components use Tailwind responsive classes
- Popup max-width constrained, full-width on mobile
- Banner text truncates with "Read more" on small screens
- Sticky header uses smaller font on mobile
- Image announcements use `object-cover` with aspect ratio containers

### Performance
- Announcements cached with react-query (5-minute stale time)
- Dismissals stored locally + synced to DB
- Only active, non-expired, non-dismissed announcements rendered
- Lazy image loading for announcement images

### Paying Students Check
- Query `enrollments` table for active enrollments joined with `tuition_records` or `monthly_tuition` to verify positive balance for the `paying_students` audience target

