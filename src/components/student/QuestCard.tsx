import { motion } from "framer-motion";
import { Clock, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { dayjs } from "@/lib/date";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface QuestCardProps {
  id: string;
  title: string;
  className: string;
  dueDate?: string;
  progress?: number;
  xpReward?: number;
  type: "homework" | "session" | "challenge";
  status: "pending" | "in_progress" | "completed" | "overdue";
  onClick?: () => void;
}

const typeConfig = {
  homework: { icon: "📚", label: "Homework", color: "accent" },
  session: { icon: "🎓", label: "Class", color: "primary" },
  challenge: { icon: "🎯", label: "Challenge", color: "warning" },
};

const statusConfig = {
  pending: { badge: "Pending", variant: "secondary" as const },
  in_progress: { badge: "In Progress", variant: "default" as const },
  completed: { badge: "Done!", variant: "default" as const },
  overdue: { badge: "Overdue", variant: "destructive" as const },
};

export function QuestCard({
  id,
  title,
  className,
  dueDate,
  progress = 0,
  xpReward = 20,
  type,
  status,
  onClick
}: QuestCardProps) {
  const { icon, label, color } = typeConfig[type];
  const { badge, variant } = statusConfig[status];
  
  const isOverdue = status === "overdue";
  const isCompleted = status === "completed";
  const daysUntilDue = dueDate ? dayjs(dueDate).diff(dayjs(), 'day') : null;
  const isUrgent = daysUntilDue !== null && daysUntilDue <= 1 && !isCompleted;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all ${
        isCompleted 
          ? 'bg-success/10 border border-success/20' 
          : isOverdue
            ? 'bg-destructive/10 border border-destructive/20'
            : 'glass hover:shadow-xl border border-transparent'
      }`}
      onClick={onClick}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Urgent pulse effect */}
      {isUrgent && !isCompleted && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-warning/20 to-transparent"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="relative p-4 flex items-center gap-4">
        {/* Quest Icon */}
        <motion.div 
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
            isCompleted 
              ? 'bg-success/20' 
              : isOverdue
                ? 'bg-destructive/20'
                : `bg-${color}/10`
          }`}
          animate={isCompleted ? { rotate: [0, 10, -10, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          {isCompleted ? '✅' : icon}
        </motion.div>

        {/* Quest Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className={`font-semibold truncate ${isCompleted ? 'text-success line-through' : 'text-foreground'}`}>
              {title}
            </h4>
            {isCompleted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              >
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              </motion.div>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium bg-${color}/10 text-${color}`}>
              {className}
            </span>
            {dueDate && (
              <div className={`flex items-center gap-1 ${isUrgent ? 'text-warning' : ''}`}>
                {isUrgent && <AlertCircle className="h-3 w-3" />}
                <Clock className="h-3 w-3" />
                <span>
                  {dayjs(dueDate).format("MMM D")}
                  {isUrgent && daysUntilDue === 0 && ' (Today!)'}
                  {isUrgent && daysUntilDue === 1 && ' (Tomorrow)'}
                </span>
              </div>
            )}
          </div>

          {/* Progress bar for in-progress quests */}
          {status === "in_progress" && progress > 0 && (
            <div className="pt-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-0.5">{progress}% complete</p>
            </div>
          )}
        </div>

        {/* Right side: XP + Status */}
        <div className="flex flex-col items-end gap-2">
          <Badge variant={variant} className="text-xs">
            {badge}
          </Badge>
          <motion.div 
            className={`flex items-center gap-1 text-xs font-bold ${
              isCompleted ? 'text-success' : 'text-warning'
            }`}
            animate={!isCompleted ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span>+{xpReward}</span>
            <span>XP</span>
          </motion.div>
        </div>

        {/* Arrow indicator */}
        {!isCompleted && (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    </motion.div>
  );
}
