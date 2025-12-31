import { motion, AnimatePresence } from "framer-motion";
import { X, Sword, BookOpen, TrendingUp, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { getAvatarUrl, getRandomAvatarUrl } from "@/lib/avatars";
import { RadarChartTab } from "./analytics/RadarChartTab";
import { PerformanceHeatmapTab } from "./analytics/PerformanceHeatmapTab";
import { QuestLogTab } from "./analytics/QuestLogTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
interface StudentAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    totalPoints: number;
    rank: number;
  } | null;
  classId: string;
}

function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
  // XP thresholds: 0-100 = Lv1, 100-300 = Lv2, 300-600 = Lv3, etc.
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
  
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  
  const currentThreshold = thresholds[level - 1] ?? thresholds[thresholds.length - 1];
  const nextThreshold = thresholds[level] ?? thresholds[thresholds.length - 1] + 1000;
  const currentXp = xp - currentThreshold;
  const nextLevelXp = nextThreshold - currentThreshold;
  const progress = Math.min((currentXp / nextLevelXp) * 100, 100);
  
  return { level, currentXp, nextLevelXp, progress };
}

function getRankGlow(rank: number): string {
  switch (rank) {
    case 1:
      return "ring-4 ring-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.5)]";
    case 2:
      return "ring-4 ring-gray-300/50 shadow-[0_0_30px_rgba(156,163,175,0.5)]";
    case 3:
      return "ring-4 ring-amber-600/50 shadow-[0_0_30px_rgba(217,119,6,0.5)]";
    default:
      return "ring-2 ring-primary/30";
  }
}

function getRankBadge(rank: number): React.ReactNode {
  const baseClasses = "absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-black text-sm";
  
  switch (rank) {
    case 1:
      return <div className={`${baseClasses} bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900`}>#1 CHAMPION</div>;
    case 2:
      return <div className={`${baseClasses} bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800`}>#2 ELITE</div>;
    case 3:
      return <div className={`${baseClasses} bg-gradient-to-r from-amber-500 to-amber-700 text-amber-100`}>#3 WARRIOR</div>;
    default:
      return <div className={`${baseClasses} bg-primary/20 text-primary border border-primary/30`}>#{rank}</div>;
  }
}

export function StudentAnalyticsModal({ open, onOpenChange, student, classId }: StudentAnalyticsModalProps) {
  // Fetch the current viewer's student ID to determine if viewing own profile or classmate's
  const { data: viewerStudentId } = useQuery({
    queryKey: ["viewer-student-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("linked_user_id", user.id)
        .maybeSingle();
      
      return data?.id || null;
    },
    enabled: open,
  });

  if (!student) return null;

  const levelInfo = calculateLevel(student.totalPoints);
  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            >
              {/* Header Section - Character Profile */}
              <div className="relative p-6 pb-8 bg-gradient-to-br from-primary/20 via-background to-purple-500/10 border-b border-border/50">
                {/* Background sparkles */}
                <div className="absolute inset-0 overflow-hidden">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-primary/40 rounded-full"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                      }}
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => onOpenChange(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/50 transition-colors z-10"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative flex flex-col items-center">
                  {/* Avatar with glow */}
                  <motion.div
                    className="relative mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                  >
                    <Avatar className={`h-28 w-28 ${getRankGlow(student.rank)} transition-all`}>
                      <AvatarImage
                        src={getAvatarUrl(student.avatarUrl) || getRandomAvatarUrl(student.id)}
                        alt={student.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-3xl font-black">
                        <img
                          src={getRandomAvatarUrl(student.id)}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      </AvatarFallback>
                    </Avatar>
                    {getRankBadge(student.rank)}
                  </motion.div>

                  {/* Name and Level */}
                  <motion.h2
                    className="text-2xl font-black text-foreground mb-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {student.name}
                  </motion.h2>

                  <motion.div
                    className="flex items-center gap-2 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">Level {levelInfo.level}</span>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </motion.div>

                  {/* XP Progress Bar */}
                  <motion.div
                    className="w-full max-w-xs"
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>XP: {student.totalPoints}</span>
                      <span>Next: {levelInfo.currentXp}/{levelInfo.nextLevelXp}</span>
                    </div>
                    <div className="relative">
                      <Progress value={levelInfo.progress} className="h-3 bg-muted/50" />
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Tabs Section */}
              <div className="p-6">
                <Tabs defaultValue="attributes" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="attributes" className="flex items-center gap-2">
                      <Sword className="h-4 w-4" />
                      <span className="hidden sm:inline">Attributes</span>
                    </TabsTrigger>
                    <TabsTrigger value="heatmap" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span className="hidden sm:inline">Performance</span>
                    </TabsTrigger>
                    <TabsTrigger value="quests" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <span className="hidden sm:inline">Quest Log</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="attributes">
                    <RadarChartTab studentId={student.id} classId={classId} />
                  </TabsContent>

                  <TabsContent value="heatmap">
                    <PerformanceHeatmapTab studentId={student.id} classId={classId} />
                  </TabsContent>

                  <TabsContent value="quests">
                    <QuestLogTab 
                      studentId={student.id} 
                      classId={classId} 
                      viewerStudentId={viewerStudentId || undefined}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
