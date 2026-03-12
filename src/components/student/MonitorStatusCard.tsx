import { Shield, Crown, Sparkles, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface MonitorStatusCardProps {
  classNames: string[];
}

/** Floating particle used for the golden dust effect */
function GoldParticle({ delay, x, size }: { delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: 0,
        background: `radial-gradient(circle, hsl(var(--monitor-gold-light)), hsl(var(--monitor-gold)) 60%, transparent)`,
      }}
      animate={{
        y: [0, -180, -320],
        x: [0, (Math.random() - 0.5) * 60],
        opacity: [0, 1, 0],
        scale: [0.5, 1.2, 0],
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        repeat: Infinity,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

export function MonitorStatusCard({ classNames }: MonitorStatusCardProps) {
  if (classNames.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="relative overflow-hidden rounded-3xl border-2 shadow-2xl p-0"
      style={{
        borderColor: "hsl(var(--monitor-border))",
        boxShadow: `0 0 60px hsl(var(--monitor-glow)), 0 0 120px hsl(var(--monitor-glow)), 0 20px 50px rgba(0,0,0,0.15)`,
      }}
    >
      {/* Multi-layer background */}
      <div className="absolute inset-0 bg-gradient-to-br from-warning/15 via-card to-warning/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--monitor-gold-light)/0.2),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--monitor-gold)/0.15),transparent_60%)]" />

      {/* Holographic sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(105deg, transparent 40%, hsl(var(--monitor-gold-light) / 0.25) 45%, hsl(var(--monitor-gold) / 0.35) 50%, transparent 55%)",
        }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
      />

      {/* Gold particle rain */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <GoldParticle
            key={i}
            delay={i * 0.4}
            x={Math.random() * 100}
            size={Math.random() * 4 + 2}
          />
        ))}
      </div>

      {/* Corner crowns */}
      <motion.div
        className="absolute -top-2 -right-2 text-3xl opacity-30"
        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        👑
      </motion.div>
      <motion.div
        className="absolute -bottom-1 -left-1 text-2xl opacity-20 rotate-180"
        animate={{ rotate: [180, 190, 170, 180] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        👑
      </motion.div>

      {/* Content */}
      <div className="relative p-6 md:p-8">
        <div className="flex items-center gap-5">
          {/* Animated Shield with Ring */}
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ background: "hsl(var(--monitor-glow))" }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl"
              style={{
                background: "linear-gradient(135deg, hsl(var(--monitor-gold)), hsl(var(--monitor-crown)), hsl(var(--monitor-gold-dark)))",
              }}
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Shield className="h-8 w-8 text-white drop-shadow-lg" />
              {/* Crown overlay */}
              <motion.div
                className="absolute -top-3 -right-1"
                animate={{ y: [0, -3, 0], rotate: [0, 8, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Crown className="h-5 w-5 drop-shadow-md" style={{ color: "hsl(var(--monitor-gold))" }} />
              </motion.div>
            </motion.div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                Royal Monitor
              </h3>
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-5 w-5" style={{ color: "hsl(var(--monitor-gold))" }} />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Star className="h-4 w-4 fill-current" style={{ color: "hsl(var(--monitor-gold-light))" }} />
              </motion.div>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              You've been crowned as a class leader! 👑
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {classNames.map((name) => (
                <motion.div
                  key={name}
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Badge
                    className="px-3 py-1 text-xs font-bold border-2 shadow-md"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--monitor-gold) / 0.25), hsl(var(--monitor-gold-dark) / 0.15))",
                      borderColor: "hsl(var(--monitor-border) / 0.6)",
                      color: "hsl(var(--monitor-gold-dark))",
                    }}
                  >
                    👑 {name}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
