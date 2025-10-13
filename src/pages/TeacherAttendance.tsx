import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CalendarMonth from "@/components/calendar/CalendarMonth";
import SessionDrawer from "@/components/admin/class/SessionDrawer";

export default function TeacherAttendance() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const currentMonth = dayjs().format("YYYY-MM");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["teacher-sessions", month],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) throw new Error("Not a teacher");

      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const { data } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          notes,
          classes!inner(id, name)
        `)
        .eq("teacher_id", teacher.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      return data?.map(s => ({
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        notes: s.notes,
        class_name: (s.classes as any).name,
        class_id: (s.classes as any).id
      })) || [];
    },
  });

  const { data: enrolledStudents } = useQuery({
    queryKey: ["session-students", selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession) return [];

      const { data } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students!inner(id, full_name),
          start_date
        `)
        .eq("class_id", selectedSession.class_id)
        .is("end_date", null);

      const studentsWithAttendance = await Promise.all(
        (data || []).map(async (enrollment) => {
          const { data: attendance } = await supabase
            .from("attendance")
            .select("status")
            .eq("session_id", selectedSession.id)
            .eq("student_id", enrollment.student_id)
            .maybeSingle();

          return {
            id: enrollment.student_id,
            full_name: (enrollment.students as any).full_name,
            enrolled_since: enrollment.start_date,
            attendance_status: attendance?.status
          };
        })
      );

      return studentsWithAttendance;
    },
    enabled: !!selectedSession,
  });

  const prevMonth = () => {
    setMonth(dayjs(month).subtract(1, "month").format("YYYY-MM"));
  };

  const nextMonth = () => {
    const next = dayjs(month).add(1, "month").format("YYYY-MM");
    if (next <= currentMonth) {
      setMonth(next);
    }
  };

  if (isLoading) {
    return <Layout title="Attendance">Loading...</Layout>;
  }

  return (
    <Layout title="Attendance">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[200px] text-center">
              {dayjs(month).format("MMMM YYYY")}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              disabled={dayjs(month).add(1, "month").format("YYYY-MM") > currentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CalendarMonth
          month={month}
          events={sessions || []}
          onSelectEvent={(event) => setSelectedSession(event)}
        />
      </div>

      {selectedSession && (
        <SessionDrawer
          session={selectedSession}
          students={enrolledStudents || []}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </Layout>
  );
}
