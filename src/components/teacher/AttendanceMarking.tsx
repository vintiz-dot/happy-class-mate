import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, addHours } from "date-fns";
import { Clock, Users } from "lucide-react";

interface Session {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  classes: {
    name: string;
  };
}

interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  student_id: string;
  status: 'Present' | 'Absent' | 'Excused';
}

export function AttendanceMarking() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'Present' | 'Absent' | 'Excused'>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTodaySessions();
  }, []);

  const loadTodaySessions = async () => {
    try {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!teacher) return;

      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("sessions")
        .select("*, classes(name)")
        .eq("teacher_id", teacher.id)
        .eq("date", today)
        .order("start_time");

      if (error) throw error;
      setSessions(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadStudentsAndAttendance = async (sessionId: string) => {
    try {
      setLoading(true);
      
      // Get enrolled students for this class
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const { data: sessionData } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("id", sessionId)
        .single();

      const { data: enrollments } = await supabase
        .from("enrollments" as any)
        .select("student_id, students(id, full_name)")
        .eq("class_id", sessionData?.class_id)
        .is("end_date", null);

      const studentsList = (enrollments?.map((e: any) => e.students).filter(Boolean) as Student[]) || [];
      setStudents(studentsList);

      // Load existing attendance
      const { data: existingAttendance } = await supabase
        .from("attendance" as any)
        .select("*")
        .eq("session_id", sessionId);

      const attendanceMap: Record<string, 'Present' | 'Absent' | 'Excused'> = {};
      existingAttendance?.forEach((record: any) => {
        attendanceMap[record.student_id] = record.status;
      });

      // Default to Present for students without records
      studentsList.forEach(student => {
        if (!attendanceMap[student.id]) {
          attendanceMap[student.id] = 'Present';
        }
      });

      setAttendance(attendanceMap);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = async (session: Session) => {
    setSelectedSession(session);
    await loadStudentsAndAttendance(session.id);
  };

  const toggleAttendance = (studentId: string) => {
    const statuses: Array<'Present' | 'Absent' | 'Excused'> = ['Present', 'Absent', 'Excused'];
    const currentIndex = statuses.indexOf(attendance[studentId]);
    const nextIndex = (currentIndex + 1) % statuses.length;
    
    setAttendance(prev => ({
      ...prev,
      [studentId]: statuses[nextIndex]
    }));
  };

  const saveAttendance = async () => {
    if (!selectedSession) return;

    try {
      setLoading(true);

      const user = await supabase.auth.getUser();
      const records = Object.entries(attendance).map(([student_id, status]) => ({
        session_id: selectedSession.id,
        student_id,
        status,
        marked_by: user.data.user?.id,
      }));

      // Upsert attendance records
      const { error } = await supabase
        .from("attendance" as any)
        .upsert(records, { 
          onConflict: 'session_id,student_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update session status to Held if not already
      if (selectedSession.status === 'Scheduled') {
        await supabase
          .from("sessions")
          .update({ status: 'Held' })
          .eq("id", selectedSession.id);
      }

      toast({
        title: "Success",
        description: "Attendance saved successfully",
      });

      setSelectedSession(null);
      loadTodaySessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isWithin24Hours = (session: Session) => {
    const sessionDateTime = new Date(`${session.date}T${session.end_time}`);
    const twentyFourHoursLater = addHours(sessionDateTime, 24);
    return new Date() <= twentyFourHoursLater;
  };

  const getStatusBadge = (status: 'Present' | 'Absent' | 'Excused') => {
    const colors = {
      Present: "bg-success/20 text-success hover:bg-success/30",
      Absent: "bg-destructive/20 text-destructive hover:bg-destructive/30",
      Excused: "bg-warning/20 text-warning hover:bg-warning/30"
    };
    return colors[status];
  };

  if (selectedSession) {
    const canEdit = selectedSession.status === 'Scheduled' || isWithin24Hours(selectedSession);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mark Attendance</CardTitle>
              <CardDescription>
                {selectedSession.classes.name} - {format(new Date(`${selectedSession.date}T${selectedSession.start_time}`), "h:mm a")}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setSelectedSession(null)}>
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit && (
            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
              Editing window closed (24 hours after session end)
            </div>
          )}
          
          {students.map(student => (
            <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
              <span className="font-medium">{student.full_name}</span>
              <Badge
                className={`cursor-pointer ${getStatusBadge(attendance[student.id])}`}
                onClick={() => canEdit && toggleAttendance(student.id)}
              >
                {attendance[student.id]}
              </Badge>
            </div>
          ))}

          {canEdit && (
            <Button onClick={saveAttendance} disabled={loading} className="w-full">
              Save Attendance
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Sessions
        </CardTitle>
        <CardDescription>Select a session to mark attendance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No sessions scheduled for today</p>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
              onClick={() => handleSessionSelect(session)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{session.classes.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(`${session.date}T${session.start_time}`), "h:mm a")} - 
                    {format(new Date(`${session.date}T${session.end_time}`), "h:mm a")}
                  </p>
                </div>
                <Badge variant={session.status === 'Held' ? 'default' : 'secondary'}>
                  {session.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
