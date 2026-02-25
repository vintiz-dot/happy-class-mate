import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { buildMonthGrid, monthKey } from "@/lib/date";
import { MonthPicker } from "@/components/MonthPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface AttendanceHeatmapProps {
  studentId: string;
}

export function AttendanceHeatmap({ studentId }: AttendanceHeatmapProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey());

  const startDate = dayjs(`${selectedMonth}-01`).startOf("month");
  const endDate = startDate.endOf("month");

  const { data } = useQuery({
    queryKey: ["attendance-heatmap", studentId, selectedMonth],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId);

      if (!enrollments?.length) return { byDate: {}, streak: 0, longestStreak: 0, xpTrend: [] };

      const classIds = enrollments.map((e) => e.class_id);
      const from = startDate.format("YYYY-MM-DD");
      const to = endDate.format("YYYY-MM-DD");

      const [sessionsRes, attendanceRes, pointsRes, streakSessionsRes, streakAttendanceRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, date, start_time, status, class:classes(name)")
          .in("class_id", classIds)
          .gte("date", from)
          .lte("date", to)
          .in("status", ["Held", "Scheduled"]),
        supabase
          .from("attendance")
          .select("session_id, status")
          .eq("student_id", studentId)
          .eq("status", "Present"),
        supabase
          .from("point_transactions")
          .select("points, type, date")
          .eq("student_id", studentId)
          .gte("date", from)
          .lte("date", to),
        // For streak calc, fetch last 90 days
        supabase
          .from("sessions")
          .select("id, date")
          .in("class_id", classIds)
          .gte("date", dayjs().subtract(90, "day").format("YYYY-MM-DD"))
          .lte("date", dayjs().format("YYYY-MM-DD"))
          .in("status", ["Held", "Scheduled"]),
        supabase
          .from("attendance")
          .select("session_id, status")
          .eq("student_id", studentId)
          .eq("status", "Present"),
      ]);

      const presentSet = new Set(attendanceRes.data?.map((a) => a.session_id) || []);

      // Points by date
      const pointsByDate: Record<string, Array<{ points: number; category: string }>> = {};
      for (const pt of pointsRes.data || []) {
        if (!pointsByDate[pt.date]) pointsByDate[pt.date] = [];
        pointsByDate[pt.date].push({ points: pt.points, category: pt.type });
      }

      // Build byDate map for the month
      const byDate: Record<
        string,
        {
          count: number;
          totalPoints: number;
          sessions: Array<{ name: string; time: string; present: boolean }>;
          points: Array<{ points: number; category: string }>;
        }
      > = {};

      for (const s of sessionsRes.data || []) {
        if (!byDate[s.date])
          byDate[s.date] = { count: 0, totalPoints: 0, sessions: [], points: pointsByDate[s.date] || [] };
        const present = presentSet.has(s.id);
        if (present) byDate[s.date].count++;
        byDate[s.date].sessions.push({
          name: (s.class as any)?.name || "Class",
          time: s.start_time?.slice(0, 5) || "",
          present,
        });
        byDate[s.date].totalPoints = (pointsByDate[s.date] || []).reduce((sum, p) => sum + p.points, 0);
      }

      // Streak calculation from last 90 days
      const streakPresentSet = new Set(streakAttendanceRes.data?.map((a) => a.session_id) || []);
      const streakByDate: Record<string, { total: number; present: number }> = {};
      for (const s of streakSessionsRes.data || []) {
        if (!streakByDate[s.date]) streakByDate[s.date] = { total: 0, present: 0 };
        streakByDate[s.date].total++;
        if (streakPresentSet.has(s.id)) streakByDate[s.date].present++;
      }

      let streak = 0;
      let longestStreak = 0;
      let currentStreak = 0;
      const sortedDates = Object.keys(streakByDate).sort().reverse();
      for (const d of sortedDates) {
        const allPresent = streakByDate[d].present === streakByDate[d].total && streakByDate[d].total > 0;
        if (allPresent) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
          if (streak === 0) streak = currentStreak;
        } else {
          if (streak > 0) break;
          currentStreak = 0;
        }
      }

      // XP trend for the month
      const daysInMonth = endDate.date();
      const xpTrend: Array<{ day: number; xp: number }> = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = startDate.date(d).format("YYYY-MM-DD");
        const dayXp = (pointsByDate[dateStr] || []).reduce((s, p) => s + p.points, 0);
        xpTrend.push({ day: d, xp: dayXp });
      }

      return { byDate, streak, longestStreak, xpTrend };
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });

  const calendarDays = useMemo(() => buildMonthGrid(selectedMonth), [selectedMonth]);

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-success/40";
    if (count === 2) return "bg-success/65";
    return "bg-success";
  };

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-6">
      {/* Header with month picker + streak */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" />
            <div>
              <span className="text-lg font-bold">{data?.streak || 0}</span>
              <span className="text-xs text-muted-foreground ml-1">current streak</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">🏆</span>
            <div>
              <span className="text-lg font-bold">{data?.longestStreak || 0}</span>
              <span className="text-xs text-muted-foreground ml-1">longest</span>
            </div>
          </div>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDayHeaders.map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">
            {d}
          </div>
        ))}
        {calendarDays.map((day) => {
          const djDay = dayjs(day);
          const isCurrentMonth = djDay.format("YYYY-MM") === selectedMonth;
          const info = data?.byDate[day];
          const count = info?.count || 0;
          const isToday = day === dayjs().format("YYYY-MM-DD");
          const isFuture = djDay.isAfter(dayjs(), "day");
          const hasSession = info && info.sessions.length > 0;

          const cellContent = (
            <div
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors relative",
                !isCurrentMonth && "opacity-30",
                isCurrentMonth && !hasSession && "bg-muted/40",
                isCurrentMonth && hasSession && getIntensityClass(count),
                isCurrentMonth && isFuture && "bg-muted/20",
                isToday && "ring-2 ring-primary"
              )}
            >
              <span className={cn("font-medium", isToday && "text-primary font-bold")}>
                {djDay.date()}
              </span>
              {hasSession && isCurrentMonth && !isFuture && (
                <span className="text-[9px] mt-0.5 text-foreground/70">
                  {count}/{info.sessions.length}
                </span>
              )}
            </div>
          );

          if (!hasSession || !isCurrentMonth) {
            return <div key={day}>{cellContent}</div>;
          }

          return (
            <Popover key={day}>
              <PopoverTrigger asChild>
                <button className="focus:outline-none w-full">{cellContent}</button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3 text-xs space-y-1.5">
                <p className="font-semibold">{djDay.format("ddd, MMM D")}</p>
                {info.sessions.map((s, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>{s.name}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        s.present ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.present ? "✓" : "–"} {s.time}
                    </span>
                  </div>
                ))}
                {info.totalPoints > 0 && (
                  <>
                    <div className="border-t border-border/50 my-1.5" />
                    <p className="font-semibold text-warning">⚡ {info.totalPoints} XP earned</p>
                    {info.points.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-muted-foreground">
                        <span className="capitalize">{p.category.replace(/_/g, " ")}</span>
                        <span className="text-success font-medium">+{p.points}</span>
                      </div>
                    ))}
                  </>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
        <span>Less</span>
        <div className="w-3 h-3 rounded bg-muted" />
        <div className="w-3 h-3 rounded bg-success/40" />
        <div className="w-3 h-3 rounded bg-success/65" />
        <div className="w-3 h-3 rounded bg-success" />
        <span>More</span>
      </div>

      {/* XP Trend Line Chart */}
      {data?.xpTrend && data.xpTrend.some((d) => d.xp > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">XP Trend</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.xpTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [`${value} XP`, "Points"]}
                  labelFormatter={(day) => `Day ${day}`}
                />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
