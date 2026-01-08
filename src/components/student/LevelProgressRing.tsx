import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/avatars";
import { Star, Zap } from "lucide-react";

interface LevelProgressRingProps {
  avatarUrl?: string | null;
  name: string;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
  totalXp: number;
  size?: "sm" | "md" | "lg";
}

export function LevelProgressRing({
  avatarUrl,
  name,
  level,
  currentXp,
  nextLevelXp,
  progress,
  totalXp,
  size = "lg"
}: LevelProgressRingProps) {
  const dimensions = {
    sm: { ring: 80, avatar: 60, stroke: 3, badge: "text-xs px-2 py-0.5" },
    md: { ring: 110, avatar: 84, stroke: 4, badge: "text-sm px-3 py-1" },
    lg: { ring: 140, avatar: 108, stroke: 5, badge: "text-sm px-3 py-1.5" },
  };

  const { ring, avatar, stroke, badge } = dimensions[size];
  const radius = (ring - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div 
      className="relative"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {/* Animated glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 rounded-full blur-2xl"
        style={{ width: ring, height: ring }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* XP Progress Ring */}
      <svg 
        width={ring} 
        height={ring} 
        className="relative -rotate-90"
        style={{ filter: 'drop-shadow(0 4px 20px hsla(var(--primary), 0.3))' }}
      >
        {/* Background ring */}
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          className="opacity-30"
        />
        
        {/* Progress ring with gradient */}
        <motion.circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />

        {/* Glowing tip */}
        <motion.circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="url(#glowGradient)"
          strokeWidth={stroke + 2}
          strokeLinecap="round"
          strokeDasharray={`${stroke * 2} ${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
          style={{ filter: 'blur(2px)' }}
        />
        
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="50%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
          <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Avatar in center */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: avatar, height: avatar }}
      >
        <Avatar 
          className="w-full h-full border-4 border-background shadow-2xl"
          style={{ width: avatar, height: avatar }}
        >
          <AvatarImage 
            src={getAvatarUrl(avatarUrl) || undefined} 
            alt={name} 
            className="object-cover" 
          />
          <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-accent text-white">
            {name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Level Badge */}
      <motion.div 
        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary via-accent to-primary rounded-full shadow-lg flex items-center gap-1 ${badge}`}
        initial={{ scale: 0, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", delay: 0.8, stiffness: 400 }}
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite',
        }}
      >
        <Star className="h-3.5 w-3.5 text-white fill-white" />
        <span className="font-black text-white">LV {level}</span>
      </motion.div>

      {/* Floating XP indicator */}
      <motion.div
        className="absolute -top-2 -right-2 flex items-center gap-1 bg-gradient-to-r from-warning to-warning/80 rounded-full px-2 py-1 shadow-lg"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 1, stiffness: 300 }}
      >
        <Zap className="h-3 w-3 text-white fill-white" />
        <span className="text-xs font-bold text-white">{totalXp}</span>
      </motion.div>

      {/* Sparkles around ring */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <motion.div
          key={i}
          className="absolute text-xs"
          style={{
            left: `${50 + 55 * Math.cos((angle - 90) * Math.PI / 180)}%`,
            top: `${50 + 55 * Math.sin((angle - 90) * Math.PI / 180)}%`,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [0.5, 1, 0.5],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.3,
          }}
        >
          ✨
        </motion.div>
      ))}
    </motion.div>
  );
}
