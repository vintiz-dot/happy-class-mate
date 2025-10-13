import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, DollarSign } from "lucide-react";
import { dayjs } from "@/lib/date";
import SessionDrawer from "@/components/admin/class/SessionDrawer";
import AttendanceDrawer from "@/components/admin/class/AttendanceDrawer";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

interface GlobalCalendarProps {
  role: "admin" | "teacher" | "student";
  classId?: string;
  onAddSession?: (date: Date) => void;
  onEditSession?: (session: any) => void;
}

const GlobalCalendar = ({ role, classId, onAddSession, onEditSession }: GlobalCalendarProps) => {
  const [month, setMonth] = useState(dayjs());
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const { studentId } = useStudentProfile();

  const { data: sessions = [], refetch } = useQuery({
    queryKey: ["calendar-sessions", role, classId, studentId, month.format("YYYY-MM")],
    queryFn: async () => {
      const startDate = month.startOf("month").format("YYYY-MM-DD");
      const endDate = month.endOf("month").format("YYYY-MM-DD");

      let query = supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          notes,
          rate_override_vnd,
          class_id,
          teacher_id,
          classes!inner (id, name),
          teachers (id, full_name),
          attendance (student_id, status)
        `)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (classId) {
        query = query.eq("class_id", classId);
      } else if (role === "teacher") {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: teacher } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", user?.id)
          .maybeSingle();
        
        if (teacher) {
          query = query.eq("teacher_id", teacher.id);
        } else {
          // Teacher not found, return empty array
          return [];
        }
      } else if (role === "student") {
        // Use the selected student ID from context if available
        let activeStudentId = studentId;
        
        // If no student selected in context, try to find by linked_user_id
        if (!activeStudentId) {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("linked_user_id", user?.id)
            .maybeSingle();
          
          if (student) {
            activeStudentId = student.id;
          }
        }
        
        if (activeStudentId) {
          const { data: enrollments } = await supabase
            .from("enrollments")
            .select("class_id")
            .eq("student_id", activeStudentId)
            .gte("start_date", startDate)
            .or(`end_date.is.null,end_date.gte.${startDate}`);
          
          const classIds = enrollments?.map(e => e.class_id) || [];
          if (classIds.length > 0) {
            query = query.in("class_id", classIds);
          } else {
            // No enrollments, return empty array
            return [];
          }
        } else {
          // No student found, return empty array
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const monthDays = useMemo(() => {
    const start = month.startOf("month").startOf("isoWeek");
    const end = month.endOf("month").endOf("isoWeek");
    const days = [];
    let current = start;
    while (current.isBefore(end) || current.isSame(end, "day")) {
      days.push(current);
      current = current.add(1, "day");
    }
    return days;
  }, [month]);

  const monthStats = useMemo(() => {
    const totalSessions = sessions.length;
    const uniqueStudents = new Set(sessions.flatMap(s => s.attendance?.map((a: any) => a.student_id) || [])).size;
    const totalCost = sessions.reduce((sum, s) => sum + (s.rate_override_vnd || 0), 0);
    return { totalSessions, uniqueStudents, totalCost };
  }, [sessions]);

  const getSessionsForDay = (day: dayjs.Dayjs) => {
    return sessions.filter(s => dayjs.tz(s.date).isSame(day, "day"));
  };

  const getSessionColor = (session: any) => {
    const sessionDate = dayjs.tz(session.date);
    const now = dayjs();
    const isToday = sessionDate.isSame(now, "day");
    const isPast = sessionDate.isBefore(now, "day");
    const isFuture = sessionDate.isAfter(now, "day");
    
    // Priority 1: Explicit statuses that override date logic
    if (session.status === "Canceled") return "bg-red-100 border-red-300";
    if (session.status === "Holiday") return "bg-purple-100 border-purple-300";
    
    // Priority 2: Today's sessions
    if (isToday) return "bg-amber-100 border-amber-300";
    
    // Priority 3: Date-aware logic
    if (isPast) {
      // Past session marked as Held = correct
      if (session.status === "Held") return "bg-gray-100 border-gray-300";
      
      // Past session still "Scheduled" = needs attention (orange warning)
      if (session.status === "Scheduled") return "bg-orange-100 border-orange-300";
      
      return "bg-gray-100 border-gray-300";
    }
    
    if (isFuture) {
      // Future session incorrectly marked "Held" = treat as scheduled
      if (session.status === "Held") return "bg-green-100 border-green-300";
      
      // Future scheduled session = normal
      return "bg-green-100 border-green-300";
    }
    
    // Default: Scheduled
    return "bg-green-100 border-green-300";
  };

  const handleDayClick = (day: dayjs.Dayjs, daySessions: any[]) => {
    if (daySessions.length === 1) {
      setSelectedSession(daySessions[0]);
    } else if (daySessions.length === 0 && role === "admin" && onAddSession) {
      onAddSession(day.toDate());
    } else if (daySessions.length > 1) {
      setSelectedSession({ multiple: true, sessions: daySessions, date: day.toDate() });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(month.subtract(1, "month"))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setMonth(dayjs())}
          >
            Today
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center">
            {month.format("MMMM YYYY")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(month.add(1, "month"))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{monthStats.totalSessions} sessions</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{monthStats.uniqueStudents} students</span>
            </div>
          </Card>
          {monthStats.totalCost > 0 && (
            <Card className="px-4 py-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {monthStats.totalCost.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day, idx) => {
              const daySessions = getSessionsForDay(day);
              const isClickable = daySessions.length > 0 || (role === "admin" && onAddSession);
              const isCurrentMonth = day.isSame(month, "month");

              return (
                <button
                  key={idx}
                  onClick={() => isClickable && handleDayClick(day, daySessions)}
                  className={`min-h-[100px] p-2 border rounded-lg text-left transition-all hover:shadow-md ${
                    isClickable ? "cursor-pointer" : "cursor-default"
                  } ${day.isSame(dayjs(), "day") ? "ring-2 ring-primary" : ""} ${
                    !isCurrentMonth ? "opacity-40" : ""
                  }`}
                  disabled={!isClickable}
                >
                  <div className="text-sm font-medium mb-1">{day.format("D")}</div>
                  <div className="space-y-1">
                    {daySessions.map(session => (
                      <div
                        key={session.id}
                        className={`text-xs p-1 rounded border ${getSessionColor(session)}`}
                      >
                        <div className="font-medium truncate">{session.classes?.name}</div>
                        <div className="text-[10px]">
                          {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                        </div>
                        <Badge variant="secondary" className="text-[9px] mt-1">
                          {(() => {
                            const sessionDate = dayjs.tz(session.date);
                            const isPast = sessionDate.isBefore(dayjs(), "day");
                            
                            if (isPast && session.status === "Scheduled") return "Needs Attendance";
                            if (dayjs.tz(session.date).isSame(dayjs(), "day")) return "Today";
                            return session.status;
                          })()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-6 text-xs">
            <span className="px-3 py-1 rounded bg-green-100 border border-green-300">Scheduled (Future)</span>
            <span className="px-3 py-1 rounded bg-amber-100 border border-amber-300">Today</span>
            <span className="px-3 py-1 rounded bg-orange-100 border border-orange-300">Needs Attendance</span>
            <span className="px-3 py-1 rounded bg-gray-100 border border-gray-300">Held</span>
            <span className="px-3 py-1 rounded bg-red-100 border border-red-300">Canceled</span>
            <span className="px-3 py-1 rounded bg-purple-100 border border-purple-300">Holiday</span>
          </div>
        </CardContent>
      </Card>

      {selectedSession && !selectedSession.multiple && role !== "student" && (
        <AttendanceDrawer
          session={selectedSession}
          onClose={() => {
            setSelectedSession(null);
            refetch();
          }}
        />
      )}

      {selectedSession && !selectedSession.multiple && role === "student" && (
        <SessionDrawer
          session={selectedSession}
          students={[]}
          onClose={() => {
            setSelectedSession(null);
            refetch();
          }}
          onEdit={onEditSession}
        />
      )}
    </div>
  );
};

export default GlobalCalendar;
