import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

const statusColors = {
  Present: "bg-green-500",
  Absent: "bg-red-500",
  Excused: "bg-gray-500",
  Canceled: "bg-amber-500",
  Holiday: "bg-purple-500",
};

export function StudentAttendanceTab({ studentId }: { studentId: string }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: sessions } = useQuery({
    queryKey: ["student-attendance", studentId, selectedMonth],
    queryFn: async () => {
      const start = format(startOfMonth(new Date(selectedMonth + "-01")), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(selectedMonth + "-01")), "yyyy-MM-dd");

      // Get enrollments for the student
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .lte("start_date", end)
        .or(`end_date.is.null,end_date.gte.${start}`);

      if (!enrollments || enrollments.length === 0) return [];

      const classIds = enrollments.map((e) => e.class_id);

      // Get sessions for these classes
      const { data: sessionsData, error } = await supabase
        .from("sessions")
        .select(`
          *,
          class:classes(id, name),
          teacher:teachers(id, full_name),
          attendance(status, notes)
        `)
        .in("class_id", classIds)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      return sessionsData || [];
    },
  });

  const days = eachDayOfInterval({
    start: startOfMonth(new Date(selectedMonth + "-01")),
    end: endOfMonth(new Date(selectedMonth + "-01")),
  });

  const sessionsByDate = sessions?.reduce((acc: any, session: any) => {
    if (!acc[session.date]) acc[session.date] = [];
    acc[session.date].push(session);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label>Month</Label>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${color}`} />
                <span className="text-sm">{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {Array.from({ length: startOfMonth(new Date(selectedMonth + "-01")).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const daySessions = sessionsByDate?.[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  className="min-h-[80px] p-2 border rounded-lg"
                >
                  <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                  <div className="space-y-1">
                    {daySessions.map((session: any) => {
                      const attendance = session.attendance?.[0];
                      const status = session.status === "Canceled" 
                        ? "Canceled" 
                        : attendance?.status || "Scheduled";
                      
                      return (
                        <Badge
                          key={session.id}
                          variant="outline"
                          className={cn(
                            "text-xs block truncate",
                            statusColors[status as keyof typeof statusColors] && `${statusColors[status as keyof typeof statusColors]} text-white`
                          )}
                        >
                          {format(new Date(`2000-01-01T${session.start_time}`), "HH:mm")} {session.class?.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}