import { motion } from "framer-motion";
import { X } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { useEffect, useState } from "react";
import type { Announcement } from "@/hooks/useAnnouncements";

interface Props {
  announcement: Announcement;
  onDismiss?: () => void;
}

export const SplashAnnouncement = ({ announcement, onDismiss }: Props) => {
  const config = announcement.style_config || {};
  const bg = config.bg || "hsl(var(--background))";
  const text = config.text || "hsl(var(--foreground))";
  const autoDismissSeconds = config.auto_dismiss ? parseInt(config.auto_dismiss, 10) : 0;
  const [countdown, setCountdown] = useState(autoDismissSeconds);

  useEffect(() => {
    if (autoDismissSeconds <= 0) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          onDismiss?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoDismissSeconds, onDismiss]);

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: bg, color: text }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-full h-full flex flex-col items-center justify-start pt-[15vh] gap-4 px-2"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 25 }}
      >
        {announcement.image_url && (
          <img
            src={announcement.image_url}
            alt=""
            className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl"
            loading="eager"
            fetchPriority="high"
          />
        )}
        {announcement.title && (
          <h1 className="text-3xl md:text-4xl font-bold">{announcement.title}</h1>
        )}
        {announcement.body && (
          <div
            className="text-lg opacity-80 prose prose-lg max-w-none mx-auto"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.body) }}
          />
        )}
        {announcement.is_dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-4 px-8 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            {countdown > 0 ? `Continue (${countdown}s)` : "Continue"}
          </button>
        )}
      </motion.div>
      {announcement.is_dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </motion.div>
  );
};
