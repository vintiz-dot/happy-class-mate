import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface MascotCompanionProps {
  studentName?: string;
  streak?: number;
  pendingHomework?: number;
  level?: number;
}

const expressions = {
  happy: "😊",
  excited: "🤩",
  encouraging: "💪",
  celebrating: "🎉",
  thinking: "🤔",
  sleeping: "😴",
  loving: "🥰",
  cool: "😎",
};

const mascotMessages = [
  { condition: "high_streak", message: "Amazing streak! Keep it up! 🔥", expression: "excited" },
  { condition: "no_homework", message: "All homework done! You rock! ⭐", expression: "celebrating" },
  { condition: "has_homework", message: "You've got this! Let's finish that homework!", expression: "encouraging" },
  { condition: "morning", message: "Good morning! Ready for adventure?", expression: "happy" },
  { condition: "evening", message: "Great work today! Rest well! 🌙", expression: "loving" },
  { condition: "default", message: "Let's learn something awesome!", expression: "happy" },
];

export function MascotCompanion({ studentName, streak = 0, pendingHomework = 0, level = 1 }: MascotCompanionProps) {
  const [showBubble, setShowBubble] = useState(true);
  const [currentMessage, setCurrentMessage] = useState(mascotMessages[5]);
  const [isWaving, setIsWaving] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    
    if (streak >= 7) {
      setCurrentMessage(mascotMessages[0]);
    } else if (pendingHomework === 0) {
      setCurrentMessage(mascotMessages[1]);
    } else if (pendingHomework > 0) {
      setCurrentMessage(mascotMessages[2]);
    } else if (hour < 12) {
      setCurrentMessage(mascotMessages[3]);
    } else if (hour >= 18) {
      setCurrentMessage(mascotMessages[4]);
    } else {
      setCurrentMessage(mascotMessages[5]);
    }

    // Wave animation on mount
    setIsWaving(true);
    const waveTimer = setTimeout(() => setIsWaving(false), 2000);
    
    // Hide bubble after 8 seconds
    const bubbleTimer = setTimeout(() => setShowBubble(false), 8000);
    
    return () => {
      clearTimeout(waveTimer);
      clearTimeout(bubbleTimer);
    };
  }, [streak, pendingHomework]);

  const handleMascotClick = () => {
    setShowBubble(true);
    setIsWaving(true);
    
    // Cycle through random messages
    const randomIndex = Math.floor(Math.random() * mascotMessages.length);
    setCurrentMessage(mascotMessages[randomIndex]);
    
    setTimeout(() => setIsWaving(false), 1500);
    setTimeout(() => setShowBubble(false), 6000);
  };

  return (
    <motion.div 
      className="relative flex items-end gap-2"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.5 }}
    >
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            className="absolute bottom-full left-0 mb-2 bg-gradient-to-br from-card to-card/80 rounded-2xl rounded-bl-sm px-4 py-3 shadow-xl border border-border/50 max-w-[200px] backdrop-blur-xl"
          >
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {studentName ? `Hey ${studentName.split(' ')[0]}! ` : ''}{currentMessage.message}
            </p>
            <div className="absolute -bottom-2 left-4 w-4 h-4 bg-card border-l border-b border-border/50 transform rotate-[-45deg]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot Character */}
      <motion.div
        className="relative cursor-pointer select-none"
        onClick={handleMascotClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={isWaving ? { 
          rotate: [0, -10, 10, -10, 10, 0],
          y: [0, -5, 0, -5, 0]
        } : {
          y: [0, -3, 0],
        }}
        transition={isWaving ? {
          duration: 0.8,
          ease: "easeInOut"
        } : {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 rounded-full blur-xl scale-150 opacity-50" />
        
        {/* Mascot body */}
        <div className="relative w-16 h-16 bg-gradient-to-br from-primary via-primary to-accent rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
          {/* Face */}
          <span className="text-3xl">
            {expressions[currentMessage.expression as keyof typeof expressions] || "😊"}
          </span>
          
          {/* Level badge on mascot */}
          <motion.div 
            className="absolute -top-1 -right-1 bg-gradient-to-r from-warning to-warning/80 rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-white/50"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: "spring" }}
          >
            <span className="text-xs font-black text-white">{level}</span>
          </motion.div>
        </div>

        {/* Sparkle effects */}
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <span className="text-lg">✨</span>
        </motion.div>
        <motion.div
          className="absolute -bottom-1 -left-2"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        >
          <span className="text-sm">⭐</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
