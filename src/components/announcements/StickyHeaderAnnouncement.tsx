import { motion } from "framer-motion";
import { X } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Announcement } from "@/hooks/useAnnouncements";

interface Props {
  announcement: Announcement;
  onDismiss?: () => void;
}

export const StickyHeaderAnnouncement = ({ announcement, onDismiss }: Props) => {
  const config = announcement.style_config || {};
  const bg = config.bg || "hsl(var(--primary))";
  const text = config.text || "hsl(var(--primary-foreground))";
  const animation = config.animation;

  return (
    <motion.div
      className={`fixed top-0 left-0 right-0 z-[150] ${animation === "pulse" ? "animate-pulse" : ""}`}
      style={{ background: bg, color: text }}
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      exit={{ y: -60 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3 text-xs sm:text-sm">
        <div
          className="text-center font-medium truncate"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.body || announcement.title) }}
        />
        {announcement.is_dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-0.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
