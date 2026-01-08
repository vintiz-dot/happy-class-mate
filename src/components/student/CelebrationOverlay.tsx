import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface CelebrationOverlayProps {
  show: boolean;
  type?: "level_up" | "streak" | "achievement" | "challenge_complete";
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

const celebrationConfig = {
  level_up: {
    emoji: "🎉",
    particles: ["⭐", "✨", "🌟", "💫", "🎊"],
    colors: ["from-primary", "to-accent"],
    sound: "levelUp",
  },
  streak: {
    emoji: "🔥",
    particles: ["🔥", "💪", "⚡", "✨", "🌟"],
    colors: ["from-warning", "to-primary"],
    sound: "streak",
  },
  achievement: {
    emoji: "🏆",
    particles: ["🏆", "🥇", "⭐", "✨", "🎖️"],
    colors: ["from-warning", "to-warning/70"],
    sound: "achievement",
  },
  challenge_complete: {
    emoji: "✅",
    particles: ["✨", "🎯", "💫", "⭐", "🎊"],
    colors: ["from-success", "to-accent"],
    sound: "complete",
  },
};

export function CelebrationOverlay({
  show,
  type = "level_up",
  title = "Amazing!",
  subtitle = "You did it!",
  onComplete
}: CelebrationOverlayProps) {
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number; delay: number }>>([]);
  const config = celebrationConfig[type];

  useEffect(() => {
    if (show) {
      // Generate confetti particles
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        emoji: config.particles[Math.floor(Math.random() * config.particles.length)],
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);

      // Auto-dismiss after animation
      const timer = setTimeout(() => {
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete, config.particles]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Background overlay */}
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Confetti particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute text-3xl"
              style={{ left: `${particle.x}%`, top: '-10%' }}
              initial={{ y: 0, opacity: 0, rotate: 0 }}
              animate={{
                y: ['0vh', '110vh'],
                opacity: [0, 1, 1, 0],
                rotate: [0, 360, 720],
                x: [0, Math.random() * 100 - 50],
              }}
              transition={{
                duration: 2.5,
                delay: particle.delay,
                ease: "easeOut",
              }}
            >
              {particle.emoji}
            </motion.div>
          ))}

          {/* Main celebration content */}
          <motion.div
            className="relative z-10 text-center"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Big emoji */}
            <motion.div
              className="text-8xl mb-4"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -5, 5, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: 3,
              }}
            >
              {config.emoji}
            </motion.div>

            {/* Title */}
            <motion.h2
              className={`text-5xl font-black bg-gradient-to-r ${config.colors.join(' ')} bg-clip-text text-transparent mb-2`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {title}
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              className="text-xl text-muted-foreground"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {subtitle}
            </motion.p>

            {/* Sparkle ring */}
            <motion.div
              className="absolute inset-0 -z-10"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 2, opacity: [0, 0.5, 0] }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <div className={`w-full h-full rounded-full bg-gradient-to-r ${config.colors.join(' ')} blur-3xl`} />
            </motion.div>
          </motion.div>

          {/* Radial burst lines */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-20 bg-gradient-to-t from-primary to-transparent rounded-full"
              style={{
                left: '50%',
                top: '50%',
                transformOrigin: 'bottom center',
                rotate: `${i * 30}deg`,
              }}
              initial={{ scaleY: 0, opacity: 0, y: 0 }}
              animate={{
                scaleY: [0, 1, 0],
                opacity: [0, 1, 0],
                y: [0, -100],
              }}
              transition={{
                duration: 0.8,
                delay: 0.1 + i * 0.05,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
