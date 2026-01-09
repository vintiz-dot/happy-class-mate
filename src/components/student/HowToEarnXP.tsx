import { motion } from "framer-motion";
import { 
  Sparkles, BookOpen, Users, Calendar, Target, 
  MessageCircle, Ear, BookMarked, PenTool, Flame,
  X, Star, Zap, Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HowToEarnXPProps {
  onClose?: () => void;
}

const xpCategories = [
  {
    title: "Daily Activities",
    icon: "🌟",
    color: "from-warning/20 to-warning/10",
    items: [
      { name: "Daily Check-In", description: "Visit your homework page (automatic!)", xp: "+1 XP", icon: "✅" },
    ]
  },
  {
    title: "Class Participation",
    icon: "🎓",
    color: "from-primary/20 to-primary/10",
    items: [
      { name: "Speaking", description: "Answer questions, good pronunciation", xp: "+1-10 XP", icon: "🗣️" },
      { name: "Listening", description: "Follow instructions, active listening", xp: "+1-10 XP", icon: "👂" },
      { name: "Reading", description: "Read aloud with expression", xp: "+1-10 XP", icon: "📖" },
      { name: "Writing", description: "Neat handwriting, creative writing", xp: "+1-10 XP", icon: "✏️" },
    ]
  },
  {
    title: "Homework",
    icon: "📚",
    color: "from-accent/20 to-accent/10",
    items: [
      { name: "Complete Homework", description: "Turn in your assignments (max 100 pts)", xp: "+1-100 XP", icon: "📝" },
      { name: "Early Submission", description: "Submit before due date", xp: "+5 XP bonus", icon: "⏰" },
    ]
  },
  {
    title: "Good Behaviors",
    icon: "⭐",
    color: "from-success/20 to-success/10",
    items: [
      { name: "Focus Points", description: "Stay on task, no distractions", xp: "+1-10 XP", icon: "🎯" },
      { name: "Teamwork", description: "Help classmates, collaborate", xp: "+1-10 XP", icon: "🤝" },
    ]
  },
  {
    title: "Attendance Bonus",
    icon: "🔥",
    color: "from-destructive/20 to-destructive/10",
    items: [
      { name: "5-Class Streak", description: "Attend 5 consecutive classes", xp: "+50 Focus XP", icon: "🏆" },
    ]
  },
  {
    title: "Reading & Theory",
    icon: "📕",
    color: "from-secondary/20 to-secondary/10",
    items: [
      { name: "Quizzes & Exercises", description: "Complete theory work (no limit!)", xp: "Unlimited", icon: "📊" },
    ]
  },
];

export function HowToEarnXP({ onClose }: HowToEarnXPProps) {
  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-3 rounded-2xl bg-gradient-to-br from-warning to-warning/70"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-6 w-6 text-white" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-primary via-accent to-warning bg-clip-text text-transparent">
              How to Earn XP!
            </h2>
            <p className="text-sm text-muted-foreground">Level up by doing awesome things!</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* XP Categories */}
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        <div className="space-y-6">
          {xpCategories.map((category, categoryIndex) => (
            <motion.div
              key={category.title}
              className={`rounded-2xl p-5 bg-gradient-to-br ${category.color} border border-border/50`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{category.icon}</span>
                <h3 className="text-lg font-bold">{category.title}</h3>
              </div>

              <div className="space-y-3">
                {category.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 backdrop-blur-sm"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: categoryIndex * 0.1 + itemIndex * 0.05 }}
                    whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-warning/20 px-3 py-1.5 rounded-full">
                      <Zap className="h-4 w-4 text-warning" />
                      <span className="font-bold text-warning text-sm">{item.xp}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Tips Section */}
          <motion.div
            className="rounded-2xl p-5 bg-gradient-to-br from-primary/10 via-accent/10 to-warning/10 border border-primary/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">💡</span>
              <h3 className="text-lg font-bold">Pro Tips!</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Star className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <span>Check your homework page every day to earn your daily XP!</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <span>Attend all your scheduled classes to build up your attendance streak!</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <span>Participate in class - speaking and listening earns points!</span>
              </li>
              <li className="flex items-start gap-2">
                <Trophy className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <span>Every 5 classes you attend in a row = +50 Focus XP bonus!</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
