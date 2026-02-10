import { motion } from "framer-motion";
import { X } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Announcement } from "@/hooks/useAnnouncements";

interface Props {
  announcement: Announcement;
  onDismiss?: () => void;
}

export const BannerAnnouncement = ({ announcement, onDismiss }: Props) => {
  const config = announcement.style_config || {};
  const bg = config.bg || "hsl(var(--primary))";
  const text = config.text || "hsl(var(--primary-foreground))";
  const animation = config.animation;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`w-full overflow-hidden ${animation === "pulse" ? "animate-pulse" : ""}`}
      style={{ background: bg, color: text }}
    >
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        {announcement.image_url && (
          <img
            src={announcement.image_url}
            alt=""
            className="h-10 w-10 rounded-lg object-cover shrink-0"
            loading="eager"
          />
        )}
        <div className="flex-1 min-w-0">
          {announcement.title && (
            <p className="font-semibold text-sm">{announcement.title}</p>
          )}
          {announcement.body && (
            <div
              className="text-sm opacity-90 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.body) }}
            />
          )}
        </div>
        {announcement.is_dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
