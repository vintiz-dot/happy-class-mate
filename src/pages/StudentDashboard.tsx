import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, DollarSign, Clock, Phone, Trophy, BookOpen, Edit, Mail, Sparkles, Flame, Star, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ClassLeaderboard } from "@/components/admin/ClassLeaderboard";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudentProfileEdit } from "@/components/student/StudentProfileEdit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/avatars";
import { useStudentMonthFinance, formatVND } from "@/hooks/useStudentMonthFinance";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  }
};

const floatVariants = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const }
  }
};

// Level calculation
function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
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

// Time-based greeting
function getGreeting(): { text: string; emoji: string; subtext: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good Morning", emoji: "☀️", subtext: "Ready to learn something new?" };
  if (hour < 17) return { text: "Good Afternoon", emoji: "🌤️", subtext: "Keep up the great work!" };
  if (hour < 21) return { text: "Good Evening", emoji: "🌙", subtext: "Time for some evening study!" };
  return { text: "Good Night", emoji: "✨", subtext: "Burning the midnight oil?" };
}

export default function StudentDashboard() {
  const { studentId } = useStudentProfile();
  const navigate = useNavigate();
  const currentMonth = dayjs().format("YYYY-MM");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const greeting = useMemo(() => getGreeting(), []);

  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data } = await supabase
        .from("students")
        .select(`
          id, 
          full_name, 
          email, 
          phone, 
          date_of_birth,
          avatar_url,
          is_active,
          family:families(name),
          updated_at
        `)
        .eq("id", studentId)
        .single();
      return data;
    },
    enabled: !!studentId,
  });

  // Fetch total XP for level calculation
  const { data: totalPoints } = useQuery({
    queryKey: ["student-total-points", studentId],
    queryFn: async () => {
      if (!studentId) return 0;
      const { data } = await supabase
        .from("student_points")
        .select("total_points")
        .eq("student_id", studentId);
      return data?.reduce((sum, p) => sum + (p.total_points || 0), 0) || 0;
    },
    enabled: !!studentId,
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ["student-upcoming-sessions", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          classes!inner(name)
        `)
        .in("class_id", classIds)
        .gte("date", dayjs().format("YYYY-MM-DD"))
        .lte("date", dayjs().add(7, "days").format("YYYY-MM-DD"))
        .in("status", ["Scheduled", "Held"])
        .order("date", { ascending: true })
        .limit(5);

      return data || [];
    },
    enabled: !!studentId,
  });

  const { data: pendingHomework } = useQuery({
    queryKey: ["student-pending-homework", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data: homeworks } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          due_date,
          classes(name)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: true });

      const pending = [];
      for (const hw of homeworks || []) {
        const { data: submission } = await supabase
          .from("homework_submissions")
          .select("id, status")
          .eq("homework_id", hw.id)
          .eq("student_id", studentId)
          .maybeSingle();

        if (!submission || submission.status === "pending") {
          pending.push(hw);
        }
      }

      return pending.slice(0, 5);
    },
    enabled: !!studentId,
  });

  const { data: tuitionData } = useStudentMonthFinance(studentId, currentMonth);

  const { data: enrolledClasses } = useQuery({
    queryKey: ["student-enrolled-classes", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          id,
          class_id,
          classes(id, name)
        `)
        .eq("student_id", studentId)
        .is("end_date", null);

      return enrollments || [];
    },
    enabled: !!studentId,
  });

  const levelInfo = calculateLevel(totalPoints || 0);

  if (!studentId || !studentProfile) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center min-h-[50vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center glass-lg rounded-3xl p-12"
          >
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-primary animate-pulse" />
            <p className="text-xl text-muted-foreground">Please select a student profile.</p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Dashboard`}>
      {/* Premium Immersive Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/5" />
        
        {/* Animated nebula effects */}
        <motion.div 
          className="absolute top-20 left-20 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-[120px]"
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-[35rem] h-[35rem] bg-accent/10 rounded-full blur-[120px]"
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.1, 0.12, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-secondary/10 rounded-full blur-[100px]"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.08, 0.12, 0.08]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />

        {/* Starfield */}
        <div className="starfield">
          {Array.from({ length: 60 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-foreground/20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 2 + 1}px`,
                height: `${Math.random() * 2 + 1}px`,
              }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <motion.div 
        className="space-y-8 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Premium Profile Header with Level System */}
        <motion.div 
          variants={itemVariants}
          className="glass-lg border-0 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
          
          <div className="p-8 relative">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar with Level Ring */}
                <motion.div 
                  className="relative"
                  variants={floatVariants}
                  animate="animate"
                >
                  {/* XP Progress Ring */}
                  <svg className="absolute -inset-3 h-32 w-32 -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="4"
                      className="opacity-30"
                    />
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="none"
                      stroke="url(#xpGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${levelInfo.progress * 3.64} 364`}
                      initial={{ strokeDasharray: "0 364" }}
                      animate={{ strokeDasharray: `${levelInfo.progress * 3.64} 364` }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                    />
                    <defs>
                      <linearGradient id="xpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
                  
                  <Avatar className="h-24 w-24 border-4 border-background shadow-2xl relative ring-2 ring-primary/30">
                    <AvatarImage src={getAvatarUrl(studentProfile.avatar_url) || undefined} alt={studentProfile.full_name} className="object-cover" />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-accent text-white">
                      {studentProfile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Level Badge */}
                  <motion.div 
                    className="absolute -bottom-2 -right-2 bg-gradient-to-r from-primary to-accent rounded-full px-3 py-1 shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.8, stiffness: 400 }}
                  >
                    <span className="text-xs font-black text-primary-foreground flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      LV {levelInfo.level}
                    </span>
                  </motion.div>
                </motion.div>
                
                <div className="space-y-3 text-center sm:text-left">
                  {/* Greeting */}
                  <motion.div 
                    className="flex items-center gap-2 justify-center sm:justify-start"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span className="text-2xl">{greeting.emoji}</span>
                    <span className="text-lg text-muted-foreground">{greeting.text},</span>
                  </motion.div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                      {studentProfile.full_name}
                    </h1>
                    <Badge 
                      variant={studentProfile.is_active ? "default" : "secondary"} 
                      className={`${studentProfile.is_active ? "bg-gradient-to-r from-success to-success/80 shadow-lg" : ""} px-3 py-1`}
                    >
                      {studentProfile.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">{greeting.subtext}</p>
                  
                  {/* XP Display */}
                  <motion.div 
                    className="flex items-center gap-4 flex-wrap justify-center sm:justify-start"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <div className="flex items-center gap-2 glass-sm px-4 py-2 rounded-full">
                      <Zap className="h-4 w-4 text-warning" />
                      <span className="text-sm font-bold">{totalPoints || 0} XP</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {levelInfo.currentXp}/{levelInfo.nextLevelXp} to Level {levelInfo.level + 1}
                    </div>
                  </motion.div>

                  <div className="flex flex-col gap-2 text-muted-foreground">
                    {studentProfile.family?.name && (
                      <div className="flex items-center gap-2 glass-sm px-3 py-1.5 rounded-lg w-fit mx-auto sm:mx-0">
                        <span className="font-semibold text-foreground">Family:</span>
                        <span>{studentProfile.family.name}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                      {studentProfile.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-primary" />
                          <span>{studentProfile.email}</span>
                        </div>
                      )}
                      {studentProfile.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-primary" />
                          <span>{studentProfile.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={() => setShowEditProfile(true)} 
                className="glass border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 shadow-lg hover:shadow-xl self-center lg:self-start"
                variant="outline"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Premium Stats Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3">
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -4 }}
            className="glass-lg border-0 shadow-xl rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-secondary/30 to-muted/30"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <Clock className="h-6 w-6 text-secondary-foreground" />
                </motion.div>
                <CardDescription className="text-base font-medium">Upcoming Sessions</CardDescription>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
              >
                <CardTitle className="text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                  {upcomingSessions?.length || 0}
                </CardTitle>
              </motion.div>
              <p className="text-sm text-muted-foreground">Next 7 days</p>
            </div>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -4 }}
            className="glass-lg border-0 shadow-xl rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-accent/30 to-secondary/30"
                  whileHover={{ scale: 1.1, rotate: -5 }}
                >
                  <FileText className="h-6 w-6 text-accent-foreground" />
                </motion.div>
                <CardDescription className="text-base font-medium">Pending Homework</CardDescription>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <CardTitle className="text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                  {pendingHomework?.length || 0}
                </CardTitle>
              </motion.div>
              <p className="text-sm text-muted-foreground">Assignments to complete</p>
            </div>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -4 }}
            onClick={() => navigate('/tuition')} 
            className="glass-lg border-0 shadow-xl rounded-2xl p-6 backdrop-blur-xl cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-muted/30 to-accent/30"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <DollarSign className="h-6 w-6 text-muted-foreground" />
                </motion.div>
                <CardDescription className="text-base font-medium">Current Balance</CardDescription>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
              >
                <CardTitle className={`text-3xl sm:text-4xl font-bold mb-2 ${tuitionData?.carryOutDebt ? 'text-destructive' : tuitionData?.carryOutCredit ? 'text-success' : 'bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent'}`}>
                  {tuitionData?.carryOutDebt 
                    ? formatVND(tuitionData.carryOutDebt)
                    : tuitionData?.carryOutCredit
                      ? `-${formatVND(tuitionData.carryOutCredit)}`
                      : formatVND(0)}
                </CardTitle>
              </motion.div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {dayjs().format("MMMM YYYY")} 
                <span className="text-xs glass-sm px-2 py-0.5 rounded-full">Click to view</span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Premium Content Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div 
            variants={itemVariants}
            className="glass-lg border-0 shadow-xl rounded-2xl overflow-hidden"
          >
            <div className="p-6 relative">
              <div className="flex items-center gap-3 mb-6">
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <Clock className="h-6 w-6 text-primary" />
                </motion.div>
                <CardTitle className="text-2xl font-bold">Upcoming Sessions</CardTitle>
              </div>
              
              {upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((session: any, index: number) => (
                    <motion.div 
                      key={session.id} 
                      className="glass p-4 rounded-xl flex justify-between items-center hover:shadow-lg transition-all duration-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{session.classes.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {dayjs(session.date).format("MMM D, YYYY")} • {session.start_time.slice(0, 5)}
                        </p>
                      </div>
                      <Badge className="shadow-md">{session.status}</Badge>
                    </motion.div>
                  ))}
                  <Link to="/schedule">
                    <Button className="w-full glass border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 shadow-lg mt-2" variant="outline">
                      View Full Schedule
                    </Button>
                  </Link>
                </div>
              ) : (
                <motion.div 
                  className="glass-muted rounded-xl p-8 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No upcoming sessions</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            className="glass-lg border-0 shadow-xl rounded-2xl overflow-hidden"
          >
            <div className="p-6 relative">
              <div className="flex items-center gap-3 mb-6">
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <FileText className="h-6 w-6 text-accent" />
                </motion.div>
                <CardTitle className="text-2xl font-bold">Pending Homework</CardTitle>
              </div>
              
              {pendingHomework && pendingHomework.length > 0 ? (
                <div className="space-y-3">
                  {pendingHomework.map((hw: any, index: number) => (
                    <motion.div 
                      key={hw.id} 
                      className="glass p-4 rounded-xl hover:shadow-lg transition-all duration-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <p className="font-semibold text-foreground mb-1">{hw.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {hw.classes.name} • Due: {hw.due_date ? dayjs(hw.due_date).format("MMM D") : "No due date"}
                      </p>
                    </motion.div>
                  ))}
                  <Link to="/student/assignments">
                    <Button className="w-full glass border-accent/20 hover:border-accent hover:bg-accent/10 transition-all duration-300 shadow-lg mt-2" variant="outline">
                      View All Assignments
                    </Button>
                  </Link>
                </div>
              ) : (
                <motion.div 
                  className="glass-muted rounded-xl p-8 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No pending homework</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Premium Class Leaderboards */}
        {enrolledClasses && enrolledClasses.length > 0 && (
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="flex items-center gap-4">
              <motion.div 
                className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10"
                whileHover={{ scale: 1.1, rotate: 10 }}
              >
                <Trophy className="h-8 w-8 text-warning" />
              </motion.div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Class Rankings
              </h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              {enrolledClasses.map((enrollment: any, index: number) => {
                const classData = enrollment.classes;
                
                if (!classData?.id) return null;
                
                return (
                  <motion.div 
                    key={enrollment.id} 
                    className="glass-lg border-0 shadow-xl rounded-2xl overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ClassLeaderboard classId={classData.id} showAddPoints={false} />
                  </motion.div>
                );
              }).filter(Boolean)}
            </div>
          </motion.div>
        )}

        {/* Premium Quick Access Cards */}
        <motion.div 
          variants={itemVariants}
          className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4"
        >
          {[
            { to: "/schedule", icon: Calendar, title: "Schedule", desc: "View your class schedule", color: "primary" },
            { to: "/student/assignments", icon: FileText, title: "Assignments", desc: "Submit and track homework", color: "accent" },
            { to: "/student/journal", icon: BookOpen, title: "Journal", desc: "Write and manage entries", color: "success" },
            { to: "/tuition", icon: DollarSign, title: "Tuition", desc: "View payment details", color: "warning" },
          ].map((item, index) => (
            <Link key={item.to} to={item.to}>
              <motion.div 
                className="glass-lg border-0 shadow-xl rounded-2xl p-6 cursor-pointer group relative overflow-hidden h-full"
                whileHover={{ scale: 1.05, y: -4 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-${item.color}/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative">
                  <motion.div 
                    className={`p-3 rounded-xl bg-gradient-to-br from-${item.color}/20 to-${item.color}/10 w-fit mb-4`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <item.icon className={`h-6 w-6 text-${item.color}`} />
                  </motion.div>
                  <CardTitle className="text-lg sm:text-xl font-bold mb-2">{item.title}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{item.desc}</CardDescription>
                </div>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      </motion.div>

      {/* Premium Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="glass-lg border-0 shadow-2xl max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          <DialogHeader className="relative">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Edit Your Profile
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <StudentProfileEdit studentId={studentId} />
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
