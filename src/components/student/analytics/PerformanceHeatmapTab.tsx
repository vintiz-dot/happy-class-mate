import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { Loader2, Trophy, Users, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { SKILL_ICONS } from "@/lib/skillConfig";

interface PerformanceHeatmapTabProps {
  studentId: string;
  classId: string;
  selectedMonth: string;
}

const SKILLS = ["speaking", "listening", "reading", "writing", "focus", "teamwork"];

const SKILL_LABELS: Record<string, string> = {
  speaking: "Speaking",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  focus: "Focus",
  teamwork: "Teamwork",
};

const SKILL_COLORS: Record<string, string> = {
  speaking: "hsl(var(--chart-1))",
  listening: "hsl(var(--chart-2))",
  reading: "hsl(var(--chart-3))",
  writing: "hsl(var(--chart-4))",
  focus: "hsl(var(--chart-5))",
  teamwork: "hsl(var(--primary))",
};

export function PerformanceHeatmapTab({
  studentId,
  classId,
  selectedMonth,
}: PerformanceHeatmapTabProps) {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const monthStart = startOfMonth(parse(selectedMonth, "yyyy-MM", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  // Fetch session dates for the class this month
  const { data: sessionDates, isLoading: loadingSessions } = useQuery({
    queryKey: ["session-dates", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, date")
        .eq("class_id", classId)
        .gte("date", monthStartStr)
        .lte("date", monthEndStr)
        .in("status", ["Held", "Scheduled"])
        .order("date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch ALL class students' skill assessments to find leaders
  const { data: classSkillTotals, isLoading: loadingClassTotals } = useQuery({
    queryKey: ["class-skill-totals", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("student_id, skill, score, students!inner(full_name)")
        .eq("class_id", classId)
        .gte("date", monthStartStr)
        .lte("date", monthEndStr);

      if (error) throw error;

      // Aggregate by skill and student
      const totals: Record<string, Record<string, { total: number; studentName: string }>> = {};
      data?.forEach((entry: any) => {
        const skill = entry.skill;
        const sid = entry.student_id;
        const studentName = entry.students?.full_name || "Unknown";

        if (!totals[skill]) totals[skill] = {};
        if (!totals[skill][sid]) {
          totals[skill][sid] = { total: 0, studentName };
        }
        totals[skill][sid].total += entry.score;
      });

      return totals;
    },
  });

  // Fetch student's skill assessments
  const { data: studentAssessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ["student-skill-assessments", studentId, classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .gte("date", monthStartStr)
        .lte("date", monthEndStr)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch student's attendance
  const { data: attendanceRecords, isLoading: loadingAttendance } = useQuery({
    queryKey: ["student-attendance-performance", studentId, classId, selectedMonth],
    queryFn: async () => {
      const sessionIds = sessionDates?.map((s) => s.id) || [];
      if (sessionIds.length === 0) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select("session_id, status")
        .eq("student_id", studentId)
        .in("session_id", sessionIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionDates && sessionDates.length > 0,
  });

  // Calculate skill stats with class comparison
  const skillStats = useMemo(() => {
    if (!classSkillTotals) return [];

    return SKILLS.map((skill) => {
      // Get all students' totals for this skill
      const skillData = classSkillTotals[skill] || {};
      const allTotals = Object.entries(skillData).map(([id, data]) => ({
        studentId: id,
        studentName: data.studentName,
        total: data.total,
      }));

      // Find class leader
      const sortedByTotal = [...allTotals].sort((a, b) => b.total - a.total);
      const classLeader = sortedByTotal[0] || null;
      const classBest = classLeader?.total || 1;

      // Calculate class average
      const classAverage =
        allTotals.length > 0
          ? Math.round(allTotals.reduce((sum, s) => sum + s.total, 0) / allTotals.length)
          : 0;

      // Get student's total
      const studentTotal =
        studentAssessments?.filter((a) => a.skill === skill).reduce((sum, a) => sum + a.score, 0) || 0;

      // Calculate percentage vs class best
      const percentOfBest = classBest > 0 ? Math.round((studentTotal / classBest) * 100) : 0;
      const isLeader = classLeader?.studentId === studentId;

      const IconComponent = SKILL_ICONS[skill];

      return {
        skill,
        label: SKILL_LABELS[skill],
        color: SKILL_COLORS[skill],
        Icon: IconComponent,
        studentTotal,
        classBest,
        classLeader,
        classAverage,
        percentOfBest: Math.min(percentOfBest, 100),
        isLeader,
      };
    });
  }, [classSkillTotals, studentAssessments, studentId]);

  // Get session details for a skill
  const getSkillSessionDetails = (skill: string) => {
    const details: Array<{
      date: string;
      sessionId: string;
      points: number;
      comment: string | null;
      isAbsent: boolean;
    }> = [];

    // Get assessments for this skill
    const skillAssessments = studentAssessments?.filter((a) => a.skill === skill) || [];

    // Map session dates with assessment data and attendance
    sessionDates?.forEach((session) => {
      const dateStr = format(new Date(session.date), "yyyy-MM-dd");
      const attendance = attendanceRecords?.find((a) => a.session_id === session.id);
      const assessment = skillAssessments.find(
        (a) => format(new Date(a.date), "yyyy-MM-dd") === dateStr
      );

      if (attendance?.status === "Absent") {
        details.push({
          date: dateStr,
          sessionId: session.id,
          points: 0,
          comment: null,
          isAbsent: true,
        });
      } else if (assessment) {
        details.push({
          date: dateStr,
          sessionId: session.id,
          points: assessment.score,
          comment: assessment.teacher_comment,
          isAbsent: false,
        });
      }
    });

    return details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const isLoading = loadingSessions || loadingClassTotals || loadingAssessments || loadingAttendance;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionDates || sessionDates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No classes scheduled for {format(monthStart, "MMMM yyyy")}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Skills vs Class Best
          <Trophy className="h-5 w-5 text-yellow-500" />
        </h3>
        <p className="text-sm text-muted-foreground">
          Tap a skill to see your session history
        </p>
      </div>

      {/* Skill Cards */}
      <div className="space-y-3">
        {skillStats.map((skill, index) => (
          <Collapsible
            key={skill.skill}
            open={expandedSkill === skill.skill}
            onOpenChange={(open) => setExpandedSkill(open ? skill.skill : null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-sm"
            >
              <CollapsibleTrigger className="w-full p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  {/* Skill Icon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md shrink-0"
                    style={{
                      backgroundColor: `${skill.color}20`,
                      border: `2px solid ${skill.color}`,
                    }}
                  >
                    {skill.Icon && <skill.Icon className="h-5 w-5" style={{ color: skill.color }} />}
                  </div>

                  {/* Skill Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{skill.label}</span>
                      {skill.isLeader && (
                        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-xs px-1.5 py-0">
                          <Trophy className="h-3 w-3 mr-0.5" /> Leader
                        </Badge>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 bg-muted/50 rounded-full mt-2 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: skill.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.percentOfBest}%` }}
                        transition={{ delay: index * 0.08 + 0.2, duration: 0.6 }}
                      />
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>
                        You:{" "}
                        <span className="font-bold text-foreground">{skill.studentTotal}pts</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-yellow-500" />
                        Best: {skill.classBest}pts
                        {skill.classLeader && !skill.isLeader && (
                          <span className="text-muted-foreground/70">
                            ({skill.classLeader.studentName.split(" ")[0]})
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Avg: {skill.classAverage}pts
                      </span>
                    </div>
                  </div>

                  {/* Expand Arrow */}
                  <div className="text-muted-foreground shrink-0">
                    {expandedSkill === skill.skill ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 pt-2 border-t border-border/50">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Session History</h4>
                  <div className="space-y-2">
                    {getSkillSessionDetails(skill.skill).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No {skill.label.toLowerCase()} activity yet this month
                      </p>
                    ) : (
                      getSkillSessionDetails(skill.skill).map((detail, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-2.5 rounded-lg ${
                            detail.isAbsent
                              ? "bg-destructive/10 border border-destructive/30"
                              : "bg-muted/30"
                          }`}
                        >
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {format(new Date(detail.date), "MMM d")}
                          </span>
                          {detail.isAbsent ? (
                            <span className="flex items-center gap-1.5 text-destructive text-sm font-medium">
                              <AlertCircle className="h-4 w-4" />
                              Absent
                            </span>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <span
                                className="font-bold text-sm"
                                style={{ color: skill.color }}
                              >
                                +{detail.points}pts
                              </span>
                              {detail.comment && (
                                <span className="text-sm text-muted-foreground ml-2 truncate">
                                  {detail.comment}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </motion.div>
          </Collapsible>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-2">
        {sessionDates.length} class session{sessionDates.length !== 1 ? "s" : ""} in{" "}
        {format(monthStart, "MMMM")}
      </div>
    </div>
  );
}
