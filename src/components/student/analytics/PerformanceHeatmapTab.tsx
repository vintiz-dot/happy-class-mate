import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Book, Pencil, Headphones, Sword, Users, Shield, Loader2 } from "lucide-react";

interface PerformanceHeatmapTabProps {
  studentId: string;
  classId: string;
  selectedMonth: string; // YYYY-MM format
}

const SKILLS = ["reading", "writing", "listening", "speaking", "teamwork", "personal"] as const;
const SKILL_LABELS: Record<string, string> = {
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
  teamwork: "Teamwork",
  personal: "Personal",
};

const SKILL_ICONS: Record<string, React.ReactNode> = {
  reading: <Book className="h-3 w-3" />,
  writing: <Pencil className="h-3 w-3" />,
  listening: <Headphones className="h-3 w-3" />,
  speaking: <Sword className="h-3 w-3" />,
  teamwork: <Users className="h-3 w-3" />,
  personal: <Shield className="h-3 w-3" />,
};

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-muted/30";
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 80) return "Excellent";
  if (score >= 50) return "Average";
  return "Needs Work";
}

export function PerformanceHeatmapTab({ studentId, classId, selectedMonth }: PerformanceHeatmapTabProps) {
  // Calculate month date range
  const monthStart = startOfMonth(parse(selectedMonth, "yyyy-MM", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");
  const monthLabel = format(monthStart, "MMMM yyyy");

  // Fetch session dates for this class in the selected month
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

      // Return unique dates as Date objects
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
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-xs text-muted-foreground">Excellent (80+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span className="text-xs text-muted-foreground">Average (50-79)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span className="text-xs text-muted-foreground">Needs Work (&lt;50)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/30" />
          <span className="text-xs text-muted-foreground">No Data</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-fit">
          {/* Date Headers */}
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `100px repeat(${sessionDates.length}, minmax(40px, 1fr))` }}>
            <div className="text-xs text-muted-foreground font-medium">Skill</div>
            {sessionDates.map((date, i) => (
              <div
                key={i}
                className="text-center text-[10px] text-muted-foreground font-medium"
              >
                {format(date, "MMM d")}
              </div>
            ))}
          </div>

          {/* Skill Rows */}
          {SKILLS.map((skill) => (
            <div
              key={skill}
              className="grid gap-1 mb-1"
              style={{ gridTemplateColumns: `100px repeat(${sessionDates.length}, minmax(40px, 1fr))` }}
            >
              {/* Skill Label */}
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span className="text-primary">{SKILL_ICONS[skill]}</span>
                <span className="truncate">{SKILL_LABELS[skill]}</span>
              </div>

              {/* Day Cells */}
              {sessionDates.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const key = `${dateStr}-${skill}`;
                const entry = assessments?.[key];
                const score = entry?.score ?? null;
                const comment = entry?.comment;

                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div
                        className={`aspect-square rounded-sm cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-primary ${getScoreColor(score)}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {format(date, "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary">{SKILL_ICONS[skill]}</span>
                          <span>{SKILL_LABELS[skill]}</span>
                        </div>
                        <div className="text-sm">
                          Score: <span className="font-bold">{score ?? "N/A"}</span>
                          <span className="text-muted-foreground ml-1">
                            ({getScoreLabel(score)})
                          </span>
                        </div>
                        {comment && (
                          <div className="text-xs text-muted-foreground italic border-t border-border pt-1 mt-1">
                            "{comment}"
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* No Data Message */}
      {!hasData && (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No skill assessments recorded yet for these sessions</p>
        </div>
      )}

      {/* Session Count Label */}
      <div className="text-center text-xs text-muted-foreground">
        {sessionDates.length} class session{sessionDates.length !== 1 ? "s" : ""} in {monthLabel}
      </div>
    </div>
  );
}
