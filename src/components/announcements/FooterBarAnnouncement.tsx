import { motion } from "framer-motion";
import { X } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Announcement } from "@/hooks/useAnnouncements";

interface Props {
  announcement: Announcement;
  onDismiss?: () => void;
}

export const FooterBarAnnouncement = ({ announcement, onDismiss }: Props) => {
  const config = announcement.style_config || {};
  const bg = config.bg || "hsl(var(--card))";
  const text = config.text || "hsl(var(--card-foreground))";

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-[150] border-t shadow-lg"
      style={{ background: bg, color: text }}
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      exit={{ y: 80 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        {announcement.image_url && (
          <img src={announcement.image_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" loading="eager" />
        )}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium truncate"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.body || announcement.title) }}
          />
        </div>
        {announcement.is_dismissible && onDismiss && (
          <button onClick={onDismiss} className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
