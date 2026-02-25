import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export function TodayAgenda() {
  const today = dayjs().format("YYYY-MM-DD");

  const { data, isLoading } = useQuery({
    queryKey: ["today-agenda", today],
    queryFn: async () => {
      const [sessionsRes, attendanceRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, start_time, end_time, status, class:classes(name), teacher:teachers(full_name)")
          .eq("date", today)
          .in("status", ["Scheduled", "Held"])
          .order("start_time"),
        supabase
          .from("attendance")
          .select("session_id, status")
          .in("status", ["Present", "Absent", "Excused"]),
      ]);

      const attendanceBySession: Record<string, { present: number; absent: number; excused: number }> = {};
      for (const a of attendanceRes.data || []) {
        if (!attendanceBySession[a.session_id]) attendanceBySession[a.session_id] = { present: 0, absent: 0, excused: 0 };
        if (a.status === "Present") attendanceBySession[a.session_id].present++;
        else if (a.status === "Absent") attendanceBySession[a.session_id].absent++;
        else if (a.status === "Excused") attendanceBySession[a.session_id].excused++;
      }

      const sessions = (sessionsRes.data || []).map((s: any) => ({
        id: s.id,
        className: s.class?.name || "Class",
        teacherName: s.teacher?.full_name || "TBD",
        startTime: s.start_time?.slice(0, 5) || "",
        endTime: s.end_time?.slice(0, 5) || "",
        status: s.status,
        attendance: attendanceBySession[s.id] || null,
      }));

      return { sessions };
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Today's Agenda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sessions = data?.sessions || [];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Clock className="h-4 w-4 text-white" />
            </div>
            Today's Agenda
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No classes today 🎉</p>
        ) : (
          sessions.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {s.startTime}–{s.endTime}
                </div>
                <div>
                  <p className="text-sm font-semibold">{s.className}</p>
                  <p className="text-xs text-muted-foreground">{s.teacherName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.status === "Held" && (
                  <Badge className="bg-success/20 text-success text-[10px]">Done</Badge>
                )}
                {s.status === "Scheduled" && (
                  <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
                )}
                {s.attendance && (
                  <span className="text-[10px] text-muted-foreground">
                    {s.attendance.present}P {s.attendance.absent > 0 ? `${s.attendance.absent}A` : ""}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
