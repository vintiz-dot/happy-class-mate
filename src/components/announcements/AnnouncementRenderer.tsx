import { AnimatePresence } from "framer-motion";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { BannerAnnouncement } from "./BannerAnnouncement";
import { PopupAnnouncement } from "./PopupAnnouncement";
import { StickyHeaderAnnouncement } from "./StickyHeaderAnnouncement";
import { FooterBarAnnouncement } from "./FooterBarAnnouncement";
import { SplashAnnouncement } from "./SplashAnnouncement";
import { ToastAnnouncement } from "./ToastAnnouncement";

export const AnnouncementRenderer = () => {
  const { announcements, dismiss } = useAnnouncements();

  if (!announcements.length) return null;

  // Group by display type — show only highest priority per type
  const byType = new Map<string, typeof announcements[0]>();
  for (const a of announcements) {
    if (!byType.has(a.display_type)) byType.set(a.display_type, a);
  }

  const rendered = Array.from(byType.values());

  return (
    <AnimatePresence mode="sync">
      {rendered.map((a) => {
        const onDismiss = a.is_dismissible ? () => dismiss(a.id) : undefined;
        switch (a.display_type) {
          case "banner":
            return <BannerAnnouncement key={a.id} announcement={a} onDismiss={onDismiss} />;
          case "popup":
            return <PopupAnnouncement key={a.id} announcement={a} onDismiss={onDismiss} />;
          case "sticky_header":
            return <StickyHeaderAnnouncement key={a.id} announcement={a} onDismiss={onDismiss} />;
          case "footer_bar":
            return <FooterBarAnnouncement key={a.id} announcement={a} onDismiss={onDismiss} />;
          case "splash":
            return <SplashAnnouncement key={a.id} announcement={a} onDismiss={onDismiss} />;
          case "toast":
            return <ToastAnnouncement key={a.id} announcement={a} onDismiss={onDismiss} />;
          default:
            return null;
        }
      })}
    </AnimatePresence>
  );
};
