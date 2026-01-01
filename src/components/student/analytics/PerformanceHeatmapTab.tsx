import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { Book, Pencil, Headphones, Sword, Users, Shield, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

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

const SKILL_COLORS: Record<string, string> = {
  reading: "#8B5CF6",    // Purple
  writing: "#F59E0B",    // Amber
  listening: "#10B981",  // Green
  speaking: "#EF4444",   // Red
  teamwork: "#3B82F6",   // Blue
  personal: "#EC4899",   // Pink
};

const SKILL_ICONS: Record<string, React.ReactNode> = {
  reading: <Book className="h-3.5 w-3.5" />,
  writing: <Pencil className="h-3.5 w-3.5" />,
  listening: <Headphones className="h-3.5 w-3.5" />,
  speaking: <Sword className="h-3.5 w-3.5" />,
  teamwork: <Users className="h-3.5 w-3.5" />,
  personal: <Shield className="h-3.5 w-3.5" />,
};

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

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!sessionDates || !assessments) return [];

    return sessionDates.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dataPoint: Record<string, string | number | null> = {
        date: format(date, "MMM d"),
        fullDate: dateStr,
      };

      SKILLS.forEach((skill) => {
        const key = `${dateStr}-${skill}`;
        dataPoint[skill] = assessments[key]?.score ?? null;
      });

      return dataPoint;
    });
  }, [sessionDates, assessments]);

  // Chart configuration
  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    SKILLS.forEach((skill) => {
      config[skill] = {
        label: SKILL_LABELS[skill],
        color: SKILL_COLORS[skill],
      };
    });
    return config;
  }, []);

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
      {/* Skill Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {SKILLS.map((skill) => (
          <div
            key={skill}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card/50 border border-border"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SKILL_COLORS[skill] }}
            />
            <span style={{ color: SKILL_COLORS[skill] }}>{SKILL_ICONS[skill]}</span>
            <span className="text-xs text-foreground font-medium">{SKILL_LABELS[skill]}</span>
          </div>
        ))}
      </div>

      {/* Trend Line Chart */}
      <div className="h-[320px] w-full">
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "Score",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--foreground))",
                  fontSize: 12,
                }}
              />

              {/* Reference lines for score thresholds */}
              <ReferenceLine
                y={80}
                stroke="#22C55E"
                strokeDasharray="5 5"
                strokeOpacity={0.6}
              />
              <ReferenceLine
                y={50}
                stroke="#EAB308"
                strokeDasharray="5 5"
                strokeOpacity={0.6}
              />

              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `Session: ${label}`}
                  />
                }
              />

              {/* Skill trend lines */}
              {SKILLS.map((skill) => (
                <Line
                  key={skill}
                  type="monotone"
                  dataKey={skill}
                  name={SKILL_LABELS[skill]}
                  stroke={SKILL_COLORS[skill]}
                  strokeWidth={2.5}
                  dot={{
                    fill: SKILL_COLORS[skill],
                    strokeWidth: 0,
                    r: 4,
                  }}
                  activeDot={{
                    r: 6,
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Threshold Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #22C55E, #22C55E 4px, transparent 4px, transparent 8px)",
            }}
          />
          <span className="text-foreground font-medium">Excellent (80+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-0.5"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #EAB308, #EAB308 4px, transparent 4px, transparent 8px)",
            }}
          />
          <span className="text-foreground font-medium">Average (50)</span>
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
