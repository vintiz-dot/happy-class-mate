import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { Book, Pencil, Headphones, MessageSquare, Users, Shield, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface PerformanceHeatmapTabProps {
  studentId: string;
  classId: string;
  selectedMonth: string; // YYYY-MM format
}

const SKILLS = ["reading", "writing", "listening", "speaking", "teamwork", "focus"] as const;

const SKILL_LABELS: Record<string, string> = {
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
  teamwork: "Teamwork",
  focus: "Focus",
};

const SKILL_COLORS: Record<string, string> = {
  reading: "#8B5CF6",
  writing: "#F59E0B",
  listening: "#10B981",
  speaking: "#EF4444",
  teamwork: "#3B82F6",
  focus: "#EC4899",
};

const SKILL_ICONS: Record<string, React.ReactNode> = {
  reading: <Book className="h-5 w-5" />,
  writing: <Pencil className="h-5 w-5" />,
  listening: <Headphones className="h-5 w-5" />,
  speaking: <MessageSquare className="h-5 w-5" />,
  teamwork: <Users className="h-5 w-5" />,
  focus: <Shield className="h-5 w-5" />,
};

const getScoreEmoji = (score: number) => {
  if (score >= 90) return "🌟";
  if (score >= 80) return "⭐";
  if (score >= 70) return "✨";
  if (score >= 50) return "💪";
  if (score > 0) return "🎯";
  return "";
};

export function PerformanceHeatmapTab({ studentId, classId, selectedMonth }: PerformanceHeatmapTabProps) {
  const monthStart = startOfMonth(parse(selectedMonth, "yyyy-MM", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");
  const monthLabel = format(monthStart, "MMMM yyyy");

  const { data: sessionDates, isLoading: sessionsLoading } = useQuery({
    queryKey: ["class-session-dates", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("date")
        .eq("class_id", classId)
        .in("status", ["Scheduled", "Held"])
        .gte("date", monthStartStr)
        .lte("date", monthEndStr)
        .order("date", { ascending: true });

      if (error) throw error;

      const uniqueDates = [...new Set(data?.map((s) => s.date) || [])];
      return uniqueDates.map((d) => new Date(d + "T00:00:00"));
    },
  });

  const { data: assessments } = useQuery({
    queryKey: ["student-heatmap", studentId, classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill, score, date, teacher_comment")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .gte("date", monthStartStr)
        .lte("date", monthEndStr);

      if (error) throw error;

      const lookup: Record<string, { score: number; comment: string | null }> = {};
      data?.forEach((entry) => {
        const key = `${entry.date}-${entry.skill}`;
        lookup[key] = { score: entry.score, comment: entry.teacher_comment };
      });

      return lookup;
    },
  });

  // Calculate best scores for each skill
  const bestScoresData = useMemo(() => {
    if (!assessments) return [];

    const bestScores: Record<string, number> = {};

    Object.entries(assessments).forEach(([key, value]) => {
      const skill = key.split("-").pop() || "";
      if (SKILLS.includes(skill as typeof SKILLS[number])) {
        if (!bestScores[skill] || value.score > bestScores[skill]) {
          bestScores[skill] = value.score;
        }
      }
    });

    return SKILLS.map((skill) => ({
      skill,
      label: SKILL_LABELS[skill],
      score: bestScores[skill] || 0,
      color: SKILL_COLORS[skill],
      icon: SKILL_ICONS[skill],
    }));
  }, [assessments]);

  const hasData = assessments && Object.keys(assessments).length > 0;
  const hasSessions = sessionDates && sessionDates.length > 0;

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasSessions) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No classes scheduled in {monthLabel}</p>
        <p className="text-sm">Performance data will appear after class sessions</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-black text-foreground flex items-center justify-center gap-2">
          <span className="text-2xl">🏆</span>
          Best Scores This Month
          <span className="text-2xl">🏆</span>
        </h3>
        <p className="text-sm text-muted-foreground">Your highest score for each skill!</p>
      </div>

      {/* Animated Skill Bars */}
      <div className="space-y-3 px-2">
        {bestScoresData.map((skill, index) => (
          <motion.div
            key={skill.skill}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, type: "spring", bounce: 0.4 }}
            className="flex items-center gap-3"
          >
            {/* Skill Icon Badge */}
            <motion.div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md shrink-0"
              style={{
                backgroundColor: skill.color + "20",
                border: `2px solid ${skill.color}`,
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <span style={{ color: skill.color }}>{skill.icon}</span>
            </motion.div>

            {/* Skill Name */}
            <div className="w-20 shrink-0">
              <span className="text-sm font-bold text-foreground">{skill.label}</span>
            </div>

            {/* Animated Progress Bar */}
            <div className="flex-1 h-9 bg-muted/30 rounded-full overflow-hidden relative border border-border/50">
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{ backgroundColor: skill.color }}
                initial={{ width: 0 }}
                animate={{ width: `${skill.score}%` }}
                transition={{
                  delay: index * 0.08 + 0.2,
                  duration: 0.8,
                  type: "spring",
                  bounce: 0.3,
                }}
              >
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: index * 0.15 + 1,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>

              {/* Score badge */}
              <motion.div
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08 + 0.5, type: "spring" }}
              >
                <span className="text-sm font-black text-foreground">{skill.score}</span>
                <span className="text-base">{getScoreEmoji(skill.score)}</span>
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Score Level Legend */}
      <motion.div
        className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-border/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-lg">🌟</span>
          <span className="font-medium text-foreground">Super Star (90+)</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-lg">⭐</span>
          <span className="font-medium text-foreground">Excellent (80+)</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-lg">✨</span>
          <span className="font-medium text-foreground">Great (70+)</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-lg">💪</span>
          <span className="font-medium text-foreground">Good (50+)</span>
        </div>
      </motion.div>

      {/* No Data Message */}
      {!hasData && (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No skill assessments recorded yet for these sessions</p>
        </div>
      )}

      {/* Session Count */}
      <div className="text-center text-xs text-muted-foreground">
        {sessionDates.length} class session{sessionDates.length !== 1 ? "s" : ""} in {monthLabel}
      </div>
    </div>
  );
}
