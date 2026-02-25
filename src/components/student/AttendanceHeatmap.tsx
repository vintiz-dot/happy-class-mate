import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

interface AttendanceHeatmapProps {
  studentId: string;
  months?: number;
}

export function AttendanceHeatmap({ studentId, months = 3 }: AttendanceHeatmapProps) {
  const startDate = dayjs().subtract(months, "month").startOf("week").add(1, "day");
  const endDate = dayjs();

  const { data: attendanceData } = useQuery({
    queryKey: ["attendance-heatmap", studentId, startDate.format("YYYY-MM-DD")],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id, start_date, end_date")
        .eq("student_id", studentId);

      if (!enrollments?.length) return { byDate: {}, streak: 0, longestStreak: 0 };

      const classIds = enrollments.map(e => e.class_id);

      const [sessionsRes, attendanceRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, date, start_time, status, class:classes(name)")
          .in("class_id", classIds)
          .gte("date", startDate.format("YYYY-MM-DD"))
          .lte("date", endDate.format("YYYY-MM-DD"))
          .in("status", ["Held", "Scheduled"]),
        supabase
          .from("attendance")
          .select("session_id, status")
          .eq("student_id", studentId)
          .eq("status", "Present"),
      ]);

      const presentSet = new Set(attendanceRes.data?.map(a => a.session_id) || []);
      const byDate: Record<string, { count: number; sessions: Array<{ name: string; time: string; present: boolean }> }> = {};

      for (const s of sessionsRes.data || []) {
        if (!byDate[s.date]) byDate[s.date] = { count: 0, sessions: [] };
        const present = presentSet.has(s.id);
        if (present) byDate[s.date].count++;
        byDate[s.date].sessions.push({
          name: (s.class as any)?.name || "Class",
          time: s.start_time?.slice(0, 5) || "",
          present,
        });
      }

      // Calculate streak
      let streak = 0;
      let longestStreak = 0;
      let currentStreak = 0;
      const sortedDates = Object.keys(byDate).sort().reverse();
      
      for (const d of sortedDates) {
        const allPresent = byDate[d].sessions.every(s => s.present);
        if (allPresent && byDate[d].sessions.length > 0) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
          if (streak === 0) streak = currentStreak;
        } else {
          if (streak > 0) break;
          currentStreak = 0;
        }
      }

      return { byDate, streak, longestStreak };
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });

  const weeks = useMemo(() => {
    const result: string[][] = [];
    let current = startDate;
    let week: string[] = [];

    while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
      week.push(current.format("YYYY-MM-DD"));
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
      current = current.add(1, "day");
    }
    if (week.length) result.push(week);
    return result;
  }, [startDate.format(), endDate.format()]);

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-success/40";
    if (count === 2) return "bg-success/65";
    return "bg-success";
  };

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = "";
    weeks.forEach((week, i) => {
      const m = dayjs(week[0]).format("MMM");
      if (m !== lastMonth) {
        labels.push({ label: m, col: i });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="space-y-4">
      {/* Streak stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          <div>
            <span className="text-lg font-bold">{attendanceData?.streak || 0}</span>
            <span className="text-xs text-muted-foreground ml-1">current streak</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">🏆</span>
          <div>
            <span className="text-lg font-bold">{attendanceData?.longestStreak || 0}</span>
            <span className="text-xs text-muted-foreground ml-1">longest</span>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex text-xs text-muted-foreground mb-1 ml-8">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                style={{ position: "relative", left: `${m.col * 16}px` }}
                className="absolute"
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-[2px] mt-5">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] text-xs text-muted-foreground pr-1 justify-between py-0">
              <span className="h-[14px] leading-[14px]">M</span>
              <span className="h-[14px] leading-[14px]">W</span>
              <span className="h-[14px] leading-[14px]">F</span>
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day) => {
                  const info = attendanceData?.byDate[day];
                  const count = info?.count || 0;
                  const isToday = day === dayjs().format("YYYY-MM-DD");
                  const isFuture = dayjs(day).isAfter(dayjs());

                  if (isFuture) {
                    return <div key={day} className="w-[14px] h-[14px] rounded-sm bg-muted/30" />;
                  }

                  const cell = (
                    <div
                      className={cn(
                        "w-[14px] h-[14px] rounded-sm transition-colors",
                        getIntensityClass(count),
                        isToday && "ring-1 ring-foreground/40"
                      )}
                    />
                  );

                  if (!info?.sessions.length) {
                    return <div key={day}>{cell}</div>;
                  }

                  return (
                    <Popover key={day}>
                      <PopoverTrigger asChild>
                        <button className="focus:outline-none">{cell}</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-3 text-xs space-y-1.5">
                        <p className="font-semibold">{dayjs(day).format("ddd, MMM D")}</p>
                        {info.sessions.map((s, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <span>{s.name}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              s.present ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                            )}>
                              {s.present ? "✓" : "–"} {s.time}
                            </span>
                          </div>
                        ))}
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground justify-end">
            <span>Less</span>
            <div className="w-[14px] h-[14px] rounded-sm bg-muted" />
            <div className="w-[14px] h-[14px] rounded-sm bg-success/40" />
            <div className="w-[14px] h-[14px] rounded-sm bg-success/65" />
            <div className="w-[14px] h-[14px] rounded-sm bg-success" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
