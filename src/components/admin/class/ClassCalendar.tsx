import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EditSessionModal from "./EditSessionModal";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";

interface AttendanceRecord {
  student_id: string;
  status: string;
}

interface SessionRow {
  id: string;
  date: string;
  status: string;
  start_time: string;
  end_time: string;
  teacher_id: string;
  rate_override_vnd: number | null;
  attendance: AttendanceRecord[];
}

const ClassCalendar = ({ classId }: { classId: string }) => {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [editing, setEditing] = useState<SessionRow | null>(null);

  const { data: sessions, refetch } = useQuery({
    queryKey: ["class-sessions", classId, month],
    queryFn: async () => {
      const startDate = format(startOfMonth(new Date(month)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(month)), "yyyy-MM-dd");

      const { data: sessionsData, error } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          status,
          start_time,
          end_time,
          teacher_id,
          rate_override_vnd,
          attendance(student_id, status)
        `)
        .eq("class_id", classId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (error) throw error;
      return sessionsData as SessionRow[];
    },
  });

  const getSessionColor = (session: SessionRow) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionDate = new Date(session.date);
    sessionDate.setHours(0, 0, 0, 0);

    if (session.status === "Canceled") return "bg-amber-200 text-amber-900";
    if (session.status === "Holiday") return "bg-purple-200 text-purple-900";
    if (sessionDate > today) return "bg-muted text-muted-foreground";

    const attendance = session.attendance || [];
    if (attendance.length === 0) return "bg-muted text-muted-foreground";

    const present = attendance.filter((a) => a.status === "Present").length;
    const absent = attendance.filter((a) => a.status === "Absent").length;
    const excused = attendance.filter((a) => a.status === "Excused").length;

    if (present >= absent && present >= excused) return "bg-green-200 text-green-900";
    if (absent >= present && absent >= excused) return "bg-red-200 text-red-900";
    return "bg-gray-300 text-gray-900";
  };

  const getMonthOptions = () => {
    const options = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM yyyy");
      options.push({ value, label });
    }
    return options;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getMonthOptions().map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {sessions?.map((session) => (
              <button
                key={session.id}
                onClick={() => setEditing(session)}
                className={`p-3 rounded text-left hover:opacity-80 transition-opacity ${getSessionColor(session)}`}
              >
                <div className="text-xs font-medium">
                  {format(new Date(session.date), "dd MMM")}
                </div>
                <div className="text-[11px] mt-1">
                  {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-6 text-xs">
            <span className="px-2 py-1 rounded bg-green-200 text-green-900">Present</span>
            <span className="px-2 py-1 rounded bg-red-200 text-red-900">Absent</span>
            <span className="px-2 py-1 rounded bg-gray-300 text-gray-900">Excused</span>
            <span className="px-2 py-1 rounded bg-amber-200 text-amber-900">Canceled</span>
            <span className="px-2 py-1 rounded bg-purple-200 text-purple-900">Holiday</span>
            <span className="px-2 py-1 rounded bg-muted text-muted-foreground">Scheduled</span>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <EditSessionModal
          session={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refetch();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default ClassCalendar;
