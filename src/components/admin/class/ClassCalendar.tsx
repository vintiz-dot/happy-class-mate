import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import CalendarMonth from "@/components/calendar/CalendarMonth";
import SessionDetailDrawer from "./SessionDetailDrawer";
import AddSessionModal from "@/components/admin/AddSessionModal";

interface ClassCalendarProps {
  classId: string;
}

const ClassCalendar = ({ classId }: ClassCalendarProps) => {
  const [month, setMonth] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [addSessionDate, setAddSessionDate] = useState<Date | null>(null);

  const { data: classData } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions, refetch } = useQuery({
    queryKey: ["class-calendar-sessions", classId, format(month, "yyyy-MM")],
    queryFn: async () => {
      const startDate = format(startOfMonth(month), "yyyy-MM-dd");
      const endDate = format(endOfMonth(month), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          notes,
          teacher_id,
          rate_override_vnd,
          teachers (id, full_name),
          attendance (student_id, status)
        `)
        .eq("class_id", classId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: enrolledCount } = useQuery({
    queryKey: ["class-enrolled-count", classId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("class_id", classId)
        .is("end_date", null);

      if (error) throw error;
      return count || 0;
    },
  });

  const calendarEvents = sessions?.map(s => ({
    id: s.id,
    date: s.date,
    start_time: s.start_time,
    end_time: s.end_time,
    class_name: classData?.name || "Class",
    status: s.status,
    enrolled_count: enrolledCount,
    notes: s.notes
  })) || [];

  const handleEventClick = (event: any) => {
    const session = sessions?.find(s => s.id === event.id);
    if (session) {
      setSelectedSession({
        ...session,
        teacher: session.teachers
      });
    }
  };

  const handleDayClick = (date: string) => {
    setAddSessionDate(new Date(date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(subMonths(month, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setMonth(new Date())}
          >
            Today
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center">
            {format(month, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => setAddSessionDate(new Date())} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Session
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{classData?.name || "Class"} Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarMonth
            month={format(month, "yyyy-MM")}
            events={calendarEvents}
            onSelectDay={handleDayClick}
            onSelectEvent={handleEventClick}
          />
        </CardContent>
      </Card>

      {selectedSession && (
        <SessionDetailDrawer
          session={selectedSession}
          onClose={() => {
            setSelectedSession(null);
            refetch();
          }}
        />
      )}

      {addSessionDate && (
        <AddSessionModal
          classId={classId}
          date={addSessionDate}
          open={!!addSessionDate}
          onClose={() => setAddSessionDate(null)}
          onSuccess={() => {
            refetch();
            setAddSessionDate(null);
          }}
        />
      )}
    </div>
  );
};

export default ClassCalendar;
