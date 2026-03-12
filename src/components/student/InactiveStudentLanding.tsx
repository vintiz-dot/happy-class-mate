import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassCatalog } from "./ClassCatalog";
import { LevelProgressRing } from "./LevelProgressRing";
import { calculateLevel, getLevelTitle } from "@/lib/levelUtils";
import { Link } from "react-router-dom";
import { BookOpen, Trophy, Star, Zap, Clock, FileText, DollarSign, Rocket, Users, TrendingUp } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

interface InactiveStudentLandingProps {
  student: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    status_message?: string | null;
  };
  isReturning: boolean;
  studentId: string;
}

export function InactiveStudentLanding({ student, isReturning, studentId }: InactiveStudentLandingProps) {
  // Fetch total XP for returning students
  const { data: totalPoints } = useQuery({
    queryKey: ["student-total-points", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_points" as any)
        .select("total_points")
        .eq("student_id", studentId);
      return (data as any[])?.reduce((sum: number, p: any) => sum + (p.total_points || 0), 0) || 0;
    },
    enabled: !!studentId && isReturning,
  });

  // Count of active students for social proof
  const { data: activeStudentCount } = useQuery({
    queryKey: ["active-student-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  const levelInfo = calculateLevel(totalPoints || 0);

  return (
    <motion.div
      className="space-y-8 max-w-5xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Section */}
      <motion.div
        variants={itemVariants}
        className="glass-lg border-0 shadow-2xl rounded-3xl overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />

        <div className="p-8 md:p-12 relative">
          {isReturning ? (
            /* --- RETURNING STUDENT --- */
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <LevelProgressRing
                avatarUrl={student.avatar_url}
                name={student.full_name}
                level={levelInfo.level}
                currentXp={levelInfo.currentXp}
                nextLevelXp={levelInfo.nextLevelXp}
                progress={levelInfo.progress}
                totalXp={totalPoints || 0}
                size="lg"
              />
              <div className="text-center lg:text-left space-y-3 flex-1">
                <motion.h1
                  className="text-3xl md:text-4xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Welcome Back, {student.full_name.split(" ")[0]}! 👋
                </motion.h1>
                <p className="text-lg text-muted-foreground">
                  We've missed you! Your <span className="font-semibold text-foreground">{getLevelTitle(levelInfo.level)}</span> title
                  and <span className="font-semibold text-warning">{totalPoints || 0} XP</span> are waiting for you.
                </p>
                <motion.div
                  className="glass rounded-xl p-4 border border-warning/30 bg-warning/5 inline-block"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <p className="text-sm font-medium text-warning flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Your classmates are earning XP without you! 🔥
                  </p>
                </motion.div>
              </div>
            </div>
          ) : (
            /* --- NEW STUDENT --- */
            <div className="text-center space-y-4">
              <motion.div
                className="text-6xl mb-4"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                🚀
              </motion.div>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Start Your Learning Journey!
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                Hey {student.full_name.split(" ")[0]}! Join a class and start earning XP,
                unlocking achievements, and climbing leaderboards!
              </p>
            </div>
          )}

          {/* Social Proof */}
          {activeStudentCount && activeStudentCount > 0 && (
            <motion.div
              variants={itemVariants}
              className="mt-6 flex justify-center"
            >
              <Badge variant="secondary" className="text-sm px-4 py-2 gap-2">
                <Users className="h-4 w-4" />
                {activeStudentCount} students are learning right now
              </Badge>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Benefits Showcase (New students) */}
      {!isReturning && (
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Earn XP", desc: "Complete homework & attend classes to level up", color: "from-warning/20 to-warning/5", iconColor: "text-warning" },
            { icon: Trophy, title: "Achievements", desc: "Unlock badges and show them off", color: "from-accent/20 to-accent/5", iconColor: "text-accent" },
            { icon: Star, title: "Leaderboards", desc: "Compete with classmates for the top spot", color: "from-primary/20 to-primary/5", iconColor: "text-primary" },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <Card className={`h-full bg-gradient-to-br ${item.color} border-0 shadow-lg`}>
                <CardContent className="p-6 text-center space-y-3">
                  <item.icon className={`h-10 w-10 mx-auto ${item.iconColor}`} />
                  <h3 className="font-bold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Historical Data Quick Access (Returning students) */}
      {isReturning && (
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
          {[
            { to: "/student/assignments", icon: BookOpen, title: "Past Homework", desc: "View your completed work", gradient: "from-accent/20 to-accent/5" },
            { to: "/tuition", icon: DollarSign, title: "Financial History", desc: "Payments & invoices", gradient: "from-warning/20 to-warning/5" },
            { to: "/student/journal", icon: FileText, title: "My Journal", desc: "Your past entries", gradient: "from-success/20 to-success/5" },
          ].map((item, i) => (
            <Link key={item.to} to={item.to}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <Card className={`h-full bg-gradient-to-br ${item.gradient} border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group`}>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-background/50">
                      <item.icon className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      )}

      {/* Class Catalog */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {isReturning ? "Ready to Come Back?" : "Available Classes"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Browse classes and send a request to join
            </p>
          </div>
        </div>
        <ClassCatalog studentId={studentId} />
      </motion.div>
    </motion.div>
  );
}
