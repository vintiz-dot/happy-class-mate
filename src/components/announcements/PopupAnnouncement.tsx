import { motion } from "framer-motion";
import { X } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Announcement } from "@/hooks/useAnnouncements";

interface Props {
  announcement: Announcement;
  onDismiss?: () => void;
}

export const PopupAnnouncement = ({ announcement, onDismiss }: Props) => {
  const config = announcement.style_config || {};
  const bg = config.bg || undefined;
  const text = config.text || undefined;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={announcement.is_dismissible ? onDismiss : undefined}
      />
      {/* Content */}
      <motion.div
        className="relative z-10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-card"
        style={{ background: bg, color: text }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {announcement.image_url && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={announcement.image_url}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        )}
        <div className="p-6">
          {announcement.title && (
            <h3 className="text-xl font-bold mb-2">{announcement.title}</h3>
          )}
          {announcement.body && (
            <div
              className="text-sm opacity-80 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.body) }}
            />
          )}
        </div>
        {announcement.is_dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};
