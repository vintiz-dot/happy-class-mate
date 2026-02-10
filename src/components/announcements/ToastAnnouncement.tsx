import { motion } from "framer-motion";
import { X } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Announcement } from "@/hooks/useAnnouncements";

interface Props {
  announcement: Announcement;
  onDismiss?: () => void;
}

export const ToastAnnouncement = ({ announcement, onDismiss }: Props) => {
  const config = announcement.style_config || {};
  const bg = config.bg || undefined;
  const text = config.text || undefined;

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-[150] max-w-sm w-full rounded-xl shadow-xl border bg-card text-card-foreground overflow-hidden"
      style={{ background: bg, color: text }}
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="p-4 flex items-start gap-3">
        {announcement.image_url && (
          <img src={announcement.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" loading="eager" />
        )}
        <div className="flex-1 min-w-0">
          {announcement.title && (
            <p className="font-semibold text-sm">{announcement.title}</p>
          )}
          {announcement.body && (
            <div
              className="text-xs opacity-80 mt-1 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.body) }}
            />
          )}
        </div>
        {announcement.is_dismissible && onDismiss && (
          <button onClick={onDismiss} className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
