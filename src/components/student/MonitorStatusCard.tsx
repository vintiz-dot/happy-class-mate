import { Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface MonitorStatusCardProps {
  classNames: string[];
}

export function MonitorStatusCard({ classNames }: MonitorStatusCardProps) {
  if (classNames.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative overflow-hidden rounded-2xl border-2 border-warning/40 bg-gradient-to-br from-warning/10 via-card to-primary/10 p-6 shadow-xl"
    >
      {/* Animated glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-warning/5 via-warning/15 to-warning/5"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center gap-4">
        <motion.div
          className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-warning to-warning/70 shadow-lg"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Shield className="h-7 w-7 text-warning-foreground" />
        </motion.div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">Class Monitor</h3>
            <Sparkles className="h-4 w-4 text-warning" />
          </div>
          <p className="text-sm text-muted-foreground">
            You've been chosen as a leader!
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {classNames.map((name) => (
              <Badge
                key={name}
                className="bg-warning/20 text-warning border-warning/30 text-xs"
              >
                🛡️ {name}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
