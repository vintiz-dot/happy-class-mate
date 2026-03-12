import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LevelProgressRing } from "./LevelProgressRing";
import { ClassCatalog } from "./ClassCatalog";
import { WelcomeTour } from "./WelcomeTour";
import {
  Sparkles, Trophy, BookOpen, Zap, Star, Target, Calendar,
  Clock, Rocket, Users, TrendingUp, Shield, ChevronRight, Lock,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 280, damping: 22 } },
};

// Mock data to show what the dashboard looks like
const MOCK_LEADERBOARD = [
  { rank: 1, name: "You ⭐", xp: 2450, highlight: true },
  { rank: 2, name: "Sarah L.", xp: 2120 },
  { rank: 3, name: "Tom K.", xp: 1890 },
  { rank: 4, name: "Mai N.", xp: 1650 },
  { rank: 5, name: "Alex P.", xp: 1420 },
];

const MOCK_SCHEDULE = [
  { day: "Mon", time: "4:00 PM", class: "English Basics", active: true },
  { day: "Wed", time: "4:00 PM", class: "English Basics", active: false },
  { day: "Fri", time: "5:30 PM", class: "Reading Club", active: false },
];

const MOCK_CHALLENGES = [
  { icon: "✅", title: "Daily Check-In", xp: 1, done: true },
  { icon: "📚", title: "Homework Hero", xp: 20, done: false },
  { icon: "🎓", title: "Class Champion", xp: 15, done: false },
];

interface DemoDashboardProps {
  student: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  studentId: string;
}

export function DemoDashboard({ student, studentId }: DemoDashboardProps) {
  const firstName = student?.full_name?.split(" ")[0] || "Student";

  return (
    <motion.div
      className="space-y-8 max-w-6xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <WelcomeTour />
      {/* Immersive background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/5" />
        <motion.div
          className="absolute top-20 left-20 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-[35rem] h-[35rem] bg-accent/10 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.12, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Starfield */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-foreground/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
            }}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.2, 1] }}
            transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}
      </div>

      {/* Hero Welcome */}
      <motion.div
        id="demo-hero"
        variants={itemVariants}
        className="glass-lg border-0 shadow-2xl rounded-3xl overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        <div className="p-8 md:p-10 relative flex flex-col md:flex-row items-center gap-8">
          {/* Level ring with demo data */}
          <LevelProgressRing
            avatarUrl={student?.avatar_url ?? null}
            name={student?.full_name || "Student"}
            level={1}
            currentXp={0}
            nextLevelXp={100}
            progress={0}
            totalXp={0}
            size="lg"
          />

          <div className="flex-1 text-center md:text-left space-y-3">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/20"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Your Adventure Begins</span>
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Welcome, {firstName}! 🚀
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              Here's a sneak peek of your dashboard. Enroll in a class to unlock everything!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Demo Preview Banner */}
      <motion.div variants={itemVariants}>
        <div className="relative rounded-2xl bg-gradient-to-r from-warning/15 via-warning/10 to-warning/15 border border-warning/25 p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-warning/20">
            <Rocket className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">This is a preview of your dashboard</p>
            <p className="text-xs text-muted-foreground">Enroll in a class below to unlock XP, leaderboards, homework tracking, and more!</p>
          </div>
          <Badge variant="secondary" className="hidden sm:flex gap-1 text-xs">
            <Lock className="h-3 w-3" /> Demo Mode
          </Badge>
        </div>
      </motion.div>

      {/* Stats Preview Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Zap, label: "Total XP", value: "0", color: "text-warning", bg: "from-warning/15 to-warning/5" },
          { icon: Trophy, label: "Rank", value: "—", color: "text-accent", bg: "from-accent/15 to-accent/5" },
          { icon: BookOpen, label: "Homework", value: "0", color: "text-primary", bg: "from-primary/15 to-primary/5" },
          { icon: Star, label: "Streak", value: "0 days", color: "text-success", bg: "from-success/15 to-success/5" },
        ].map((stat) => (
          <Card key={stat.label} className={`bg-gradient-to-br ${stat.bg} border-0 shadow-lg`}>
            <CardContent className="p-4 text-center space-y-1">
              <stat.icon className={`h-6 w-6 mx-auto ${stat.color}`} />
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Two-column layout: Leaderboard + Challenges */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Mock Leaderboard */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <CardContent className="p-6 relative space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  <h3 className="font-bold text-foreground">Class Leaderboard</h3>
                </div>
                <Badge variant="outline" className="text-xs opacity-60">Preview</Badge>
              </div>
              <div className="space-y-2">
                {MOCK_LEADERBOARD.map((entry) => (
                  <motion.div
                    key={entry.rank}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      entry.highlight
                        ? "bg-gradient-to-r from-primary/15 to-accent/10 border border-primary/20 shadow-md"
                        : "bg-muted/30"
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.rank === 1 ? "bg-warning/20 text-warning" :
                      entry.rank === 2 ? "bg-muted text-muted-foreground" :
                      entry.rank === 3 ? "bg-accent/20 text-accent" :
                      "bg-muted/50 text-muted-foreground"
                    }`}>
                      {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                    </span>
                    <span className={`flex-1 font-semibold text-sm ${entry.highlight ? "text-primary" : "text-foreground"}`}>
                      {entry.name}
                    </span>
                    <span className="text-xs font-bold text-warning flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {entry.xp.toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Mock Daily Challenges */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
            <CardContent className="p-6 relative space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-accent" />
                  <h3 className="font-bold text-foreground">Daily Challenges</h3>
                </div>
                <Badge variant="outline" className="text-xs opacity-60">Preview</Badge>
              </div>
              <div className="space-y-3">
                {MOCK_CHALLENGES.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      c.done ? "bg-success/10 border border-success/20" : "bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{c.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">+{c.xp} XP</p>
                    </div>
                    {c.done && (
                      <Badge className="bg-success/20 text-success border-0 text-xs">Done</Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Mock Schedule Preview */}
              <div className="pt-4 border-t border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm text-foreground">Upcoming Schedule</h4>
                </div>
                {MOCK_SCHEDULE.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20">
                    <Badge variant="outline" className="text-xs font-mono w-10 justify-center">{s.day}</Badge>
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{s.time}</span>
                    <span className="text-xs font-medium text-foreground">{s.class}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* What You'll Unlock Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          What You'll Unlock
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Earn XP", desc: "Every class attended & homework completed earns you experience points", gradient: "from-warning/20 to-warning/5", iconColor: "text-warning" },
            { icon: Trophy, title: "Climb Leaderboards", desc: "Compete with classmates and become #1 in your class", gradient: "from-accent/20 to-accent/5", iconColor: "text-accent" },
            { icon: Shield, title: "Unlock Achievements", desc: "Earn badges for streaks, perfect scores, and milestones", gradient: "from-primary/20 to-primary/5", iconColor: "text-primary" },
          ].map((item) => (
            <Card key={item.title} className={`bg-gradient-to-br ${item.gradient} border-0 shadow-lg`}>
              <CardContent className="p-6 text-center space-y-3">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <item.icon className={`h-10 w-10 mx-auto ${item.iconColor}`} />
                </motion.div>
                <h3 className="font-bold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Class Catalog — Real enrollment action */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Join a Class</h2>
            <p className="text-sm text-muted-foreground">Browse available classes and send a request to enroll</p>
          </div>
        </div>
        <ClassCatalog studentId={studentId} />
      </motion.div>
    </motion.div>
  );
}
