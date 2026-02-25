import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { buildMonthGrid, monthKey } from "@/lib/date";
import { MonthPicker } from "@/components/MonthPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StudentScheduleCalendarProps {
  studentId: string;
}

export function StudentScheduleCalendar({ studentId }: StudentScheduleCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey());

  const startDate = dayjs(`${selectedMonth}-01`).startOf("month");
  const endDate = startDate.endOf("month");
  const today = dayjs().format("YYYY-MM-DD");

  const { data, isLoading } = useQuery({
    queryKey: ["student-schedule-calendar", studentId, selectedMonth],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id, start_date, end_date")
        .eq("student_id", studentId);

      if (!enrollments?.length) return { byDate: {}, streak: 0, longestStreak: 0, xpTrend: [] };

      // Helper: was student enrolled in this class on this date?
      const wasEnrolled = (classId: string, date: string) =>
        enrollments.some(e =>
          e.class_id === classId &&
          e.start_date <= date &&
          (!e.end_date || e.end_date >= date)
        );

      const classIds = [...new Set(enrollments.map((e) => e.class_id))];
      const from = startDate.format("YYYY-MM-DD");
      const to = endDate.format("YYYY-MM-DD");

      const [sessionsRes, attendanceRes, pointsRes, homeworksRes, submissionsRes, streakSessionsRes, streakAttendanceRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, date, start_time, end_time, status, class_id, class:classes(name), teacher:teachers(full_name, avatar_url)")
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
        supabase
          .from("homeworks")
          .select("id, title, due_date, class_id, classes(name)")
          .in("class_id", classIds)
          .gte("due_date", from)
          .lte("due_date", to),
        supabase
          .from("homework_submissions")
          .select("id, homework_id, status, grade, submitted_at")
          .eq("student_id", studentId),
        // Streak: last 90 days
        supabase
          .from("sessions")
          .select("id, date, class_id")
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

      // Post-filter sessions and homeworks by enrollment dates
      const filteredSessions = (sessionsRes.data || []).filter(s => wasEnrolled(s.class_id, s.date));
      const filteredHomeworks = (homeworksRes.data || []).filter(hw => hw.due_date && wasEnrolled(hw.class_id, hw.due_date));
      const filteredStreakSessions = (streakSessionsRes.data || []).filter(s => wasEnrolled(s.class_id, s.date));

      const presentSet = new Set(attendanceRes.data?.map((a) => a.session_id) || []);
      const submissionMap = new Map((submissionsRes.data || []).map(s => [s.homework_id, s]));

      // Points by date
      const pointsByDate: Record<string, Array<{ points: number; category: string }>> = {};
      for (const pt of pointsRes.data || []) {
        if (!pointsByDate[pt.date]) pointsByDate[pt.date] = [];
        pointsByDate[pt.date].push({ points: pt.points, category: pt.type });
      }

      // Homeworks by due date
      const homeworksByDate: Record<string, Array<{ id: string; title: string; className: string; submission: any }>> = {};
      for (const hw of filteredHomeworks) {
        const d = hw.due_date;
        if (!d) continue;
        if (!homeworksByDate[d]) homeworksByDate[d] = [];
        homeworksByDate[d].push({
          id: hw.id,
          title: hw.title,
          className: (hw.classes as any)?.name || "Class",
          submission: submissionMap.get(hw.id) || null,
        });
      }

      // Build byDate
      type DayInfo = {
        sessions: Array<{ name: string; time: string; endTime: string; present: boolean; teacherName: string; teacherAvatar: string | null }>;
        points: Array<{ points: number; category: string }>;
        totalPoints: number;
        attendedCount: number;
        homeworks: Array<{ id: string; title: string; className: string; submission: any }>;
      };
      const byDate: Record<string, DayInfo> = {};

      for (const s of filteredSessions) {
        if (!byDate[s.date]) byDate[s.date] = { sessions: [], points: pointsByDate[s.date] || [], totalPoints: 0, attendedCount: 0, homeworks: homeworksByDate[s.date] || [] };
        const present = presentSet.has(s.id);
        if (present) byDate[s.date].attendedCount++;
        byDate[s.date].sessions.push({
          name: (s.class as any)?.name || "Class",
          time: s.start_time?.slice(0, 5) || "",
          endTime: s.end_time?.slice(0, 5) || "",
          present,
          teacherName: (s.teacher as any)?.full_name || "Teacher",
          teacherAvatar: (s.teacher as any)?.avatar_url || null,
        });
        byDate[s.date].totalPoints = (pointsByDate[s.date] || []).reduce((sum, p) => sum + p.points, 0);
      }

      // Also add homework-only days
      for (const [d, hws] of Object.entries(homeworksByDate)) {
        if (!byDate[d]) byDate[d] = { sessions: [], points: pointsByDate[d] || [], totalPoints: 0, attendedCount: 0, homeworks: hws };
        else if (byDate[d].homeworks.length === 0) byDate[d].homeworks = hws;
      }

      // Streak
      const streakPresentSet = new Set(streakAttendanceRes.data?.map((a) => a.session_id) || []);
      const streakByDate: Record<string, { total: number; present: number }> = {};
      for (const s of filteredStreakSessions) {
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

      // XP trend
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

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getDayBg = (day: string) => {
    const info = data?.byDate[day];
    const isFuture = dayjs(day).isAfter(dayjs(), "day");
    const isToday = day === today;

    if (!info || (!info.sessions.length && !info.homeworks.length)) return "bg-muted/30";

    if (isFuture || isToday) {
      if (info.homeworks.length > 0) return "bg-warning/20 border-warning/40";
      return "bg-primary/15 border-primary/30";
    }

    // Past
    if (info.sessions.length > 0 && info.attendedCount === info.sessions.length) return "bg-success/25 border-success/40";
    if (info.sessions.length > 0 && info.attendedCount > 0) return "bg-success/15 border-success/30";
    if (info.sessions.length > 0) return "bg-muted/40";
    if (info.homeworks.length > 0) return "bg-warning/15 border-warning/30";
    return "bg-muted/30";
  };

  const getDayEmojis = (day: string) => {
    const info = data?.byDate[day];
    if (!info) return null;
    const isFuture = dayjs(day).isAfter(dayjs(), "day");
    const emojis: string[] = [];

    if (!isFuture && info.attendedCount > 0) emojis.push("✅");
    if (!isFuture && info.totalPoints > 0) emojis.push("⭐");
    if (info.homeworks.length > 0) emojis.push("📝");
    if (isFuture && info.sessions.length > 0) emojis.push("📅");

    return emojis.length > 0 ? emojis : null;
  };

  return (
    <div className="space-y-6">
      {/* Header: Streak + Month Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-5">
          <motion.div
            className="flex items-center gap-2 glass rounded-2xl px-4 py-2"
            whileHover={{ scale: 1.05 }}
          >
            <Flame className="h-6 w-6 text-destructive" />
            <div className="text-center">
              <span className="text-2xl font-black">{data?.streak || 0}</span>
              <p className="text-[10px] text-muted-foreground leading-tight">streak 🔥</p>
            </div>
          </motion.div>
          <motion.div
            className="flex items-center gap-2 glass rounded-2xl px-4 py-2"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-xl">🏆</span>
            <div className="text-center">
              <span className="text-2xl font-black">{data?.longestStreak || 0}</span>
              <p className="text-[10px] text-muted-foreground leading-tight">best!</p>
            </div>
          </motion.div>
          {(data?.streak || 0) >= 5 && (
            <motion.span
              className="text-2xl"
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              🔥
            </motion.span>
          )}
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDayHeaders.map((d) => (
          <div key={d} className="text-xs font-bold text-muted-foreground text-center py-1.5">
            {d}
          </div>
        ))}
        {calendarDays.map((day) => {
          const djDay = dayjs(day);
          const isCurrentMonth = djDay.format("YYYY-MM") === selectedMonth;
          const isToday = day === today;
          const isFuture = djDay.isAfter(dayjs(), "day");
          const info = data?.byDate[day];
          const hasContent = info && (info.sessions.length > 0 || info.homeworks.length > 0);
          const emojis = getDayEmojis(day);

          const cellContent = (
            <motion.div
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-all relative border border-transparent min-h-[48px]",
                !isCurrentMonth && "opacity-20",
                isCurrentMonth && getDayBg(day),
                isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                hasContent && isCurrentMonth && "cursor-pointer hover:shadow-md hover:scale-[1.05]"
              )}
              whileTap={hasContent && isCurrentMonth ? { scale: 0.95 } : undefined}
            >
              {isToday && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-primary bg-background px-1 rounded">
                  TODAY
                </span>
              )}
              <span className={cn(
                "font-bold text-sm",
                isToday && "text-primary",
                !isCurrentMonth && "text-muted-foreground"
              )}>
                {djDay.date()}
              </span>
              {emojis && isCurrentMonth && (
                <div className="flex gap-0.5 mt-0.5">
                  {emojis.slice(0, 3).map((e, i) => (
                    <span key={i} className="text-[10px] leading-none">{e}</span>
                  ))}
                </div>
              )}
            </motion.div>
          );

          if (!hasContent || !isCurrentMonth) {
            return <div key={day}>{cellContent}</div>;
          }

          return (
            <Popover key={day}>
              <PopoverTrigger asChild>
                <button className="focus:outline-none w-full">{cellContent}</button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 text-sm space-y-3 pointer-events-auto">
                <p className="font-black text-base">{djDay.format("ddd, MMM D")} {isToday ? "⭐" : ""}</p>

                {/* Sessions */}
                {info!.sessions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      {isFuture ? "📅 Upcoming Classes" : "📋 Classes"}
                    </p>
                    {info!.sessions.map((s, i) => (
                      <div key={i} className="glass rounded-lg p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{s.name}</span>
                          {!isFuture && (
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-bold",
                              s.present ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                            )}>
                              {s.present ? "✅ There!" : "—"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>🕐 {s.time} – {s.endTime}</span>
                        </div>
                        {isFuture && (
                          <div className="flex items-center gap-2 text-xs">
                            <span>👩‍🏫 {s.teacherName}</span>
                            {isToday && <Badge className="bg-success text-success-foreground text-[10px] px-1.5 py-0">Today!</Badge>}
                            {djDay.diff(dayjs(), "day") === 1 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Tomorrow!</Badge>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* XP (past only) */}
                {!isFuture && info!.totalPoints > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">⚡ XP Earned</p>
                    <div className="glass rounded-lg p-2.5">
                      <p className="font-black text-warning text-lg">+{info!.totalPoints} XP</p>
                      <div className="space-y-0.5 mt-1">
                        {info!.points.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="capitalize text-muted-foreground">{p.category.replace(/_/g, " ")}</span>
                            <span className="text-success font-bold">+{p.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Homework */}
                {info!.homeworks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">📝 Homework Due</p>
                    {info!.homeworks.map((hw) => (
                      <div key={hw.id} className="glass rounded-lg p-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-xs">{hw.title}</p>
                          <p className="text-[10px] text-muted-foreground">{hw.className}</p>
                        </div>
                        {hw.submission ? (
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold",
                            hw.submission.status === "graded" ? "bg-success/20 text-success" :
                            hw.submission.status === "submitted" ? "bg-primary/20 text-primary" :
                            "bg-warning/20 text-warning"
                          )}>
                            {hw.submission.status === "graded" ? `✅ ${hw.submission.grade}` :
                             hw.submission.status === "submitted" ? "📤 Sent!" : "⏳ Pending"}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-bold">
                            {isFuture ? "📝 Do it!" : "❌ Missed"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty day */}
                {info!.sessions.length === 0 && info!.homeworks.length === 0 && (
                  <div className="text-center py-2">
                    <span className="text-3xl">🎮</span>
                    <p className="text-xs text-muted-foreground mt-1">No classes! Time to play!</p>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs justify-center">
        <span className="flex items-center gap-1"><span>✅</span> I was there!</span>
        <span className="flex items-center gap-1"><span>📅</span> Class coming!</span>
        <span className="flex items-center gap-1"><span>📝</span> Homework due</span>
        <span className="flex items-center gap-1"><span>⭐</span> XP earned!</span>
      </div>

      {/* XP Trend Chart */}
      {data?.xpTrend && data.xpTrend.some((d) => d.xp > 0) && (
        <div className="space-y-3">
          <h4 className="text-base font-bold flex items-center gap-2">⚡ XP This Month</h4>
          <div className="h-48 w-full glass rounded-2xl p-3">
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
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [`${value} XP ⚡`, "Points"]}
                  labelFormatter={(day) => `Day ${day}`}
                />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
