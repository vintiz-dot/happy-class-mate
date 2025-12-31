import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeedbackItem {
  id: string;
  points: number;
  icon: LucideIcon;
  color: string;
  count?: number;
}

interface PointFeedbackAnimationProps {
  feedbacks: FeedbackItem[];
  onComplete: (id: string) => void;
}

export function PointFeedbackAnimation({ feedbacks, onComplete }: PointFeedbackAnimationProps) {
  return (
    <AnimatePresence>
      {feedbacks.map((feedback) => {
        const Icon = feedback.icon;
        const isPositive = feedback.points > 0;
        const displayText = feedback.count && feedback.count > 1 
          ? `${isPositive ? "+" : ""}${feedback.points} × ${feedback.count}`
          : `${isPositive ? "+" : ""}${feedback.points}`;
        
        return (
          <motion.div
            key={feedback.id}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -20 }}
            exit={{ opacity: 0, y: -60, scale: 0.8 }}
            transition={{ 
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1]
            }}
            onAnimationComplete={() => onComplete(feedback.id)}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-lg shadow-lg ${
                isPositive 
                  ? "bg-green-500/90 text-white" 
                  : "bg-red-500/90 text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{displayText}</span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
