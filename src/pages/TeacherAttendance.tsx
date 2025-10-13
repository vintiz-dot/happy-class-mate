import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";

type AttendanceStatus = "Present" | "Absent" | "Excused";

export default function TeacherAttendance() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<Record<string, { status: AttendanceStatus; notes?: string }>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["teacher-today-sessions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) throw new Error("Not a teacher");

      const today = new Date().toISOString().split("T")[0];

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
        .eq("date", today)
        .eq("status", "Scheduled")
        .order("start_time");

      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["session-students", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];

      const session = sessions.find((s: any) => s.id === selectedSession);
      if (!session) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students!inner(id, full_name)
        `)
        .eq("class_id", session.classes.id)
        .lte("start_date", session.date)
        .or(`end_date.is.null,end_date.gte.${session.date}`);

      const { data: attendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("session_id", selectedSession);

      const attendanceMap: Record<string, any> = {};
      attendance?.forEach((a) => {
        attendanceMap[a.student_id] = a;
      });

      const studentsData = enrollments?.map((e: any) => ({
        ...e.students,
        attendance: attendanceMap[e.students.id],
      })) || [];

      // Initialize attendance data
      const initialData: Record<string, { status: AttendanceStatus; notes?: string }> = {};
      studentsData.forEach((s: any) => {
        initialData[s.id] = {
          status: s.attendance?.status || "Present",
          notes: s.attendance?.notes || "",
        };
      });
      setAttendanceData(initialData);

      return studentsData;
    },
    enabled: !!selectedSession,
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSession) return;

      for (const [studentId, data] of Object.entries(attendanceData)) {
        await supabase.functions.invoke("mark-attendance", {
          body: {
            sessionId: selectedSession,
            studentId,
            status: data.status,
            notes: data.notes,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-today-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session-students"] });
      toast({ title: "Attendance saved successfully" });
      setSelectedSession(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error saving attendance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleStatus = (studentId: string) => {
    const statuses: AttendanceStatus[] = ["Present", "Absent", "Excused"];
    const current = attendanceData[studentId]?.status || "Present";
    const nextIndex = (statuses.indexOf(current) + 1) % statuses.length;
    
    setAttendanceData({
      ...attendanceData,
      [studentId]: {
        ...attendanceData[studentId],
        status: statuses[nextIndex],
      },
    });
  };

  const updateNotes = (studentId: string, notes: string) => {
    setAttendanceData({
      ...attendanceData,
      [studentId]: {
        ...attendanceData[studentId],
        notes,
      },
    });
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "Present": return "bg-green-500 text-white";
      case "Absent": return "bg-red-500 text-white";
      case "Excused": return "bg-gray-500 text-white";
      default: return "bg-muted";
    }
  };

  return (
    <Layout title="Mark Attendance">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mark Attendance</h1>
          <p className="text-muted-foreground">Mark attendance for today's sessions</p>
        </div>

        {!selectedSession ? (
          <div className="grid gap-4">
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sessions scheduled for today</p>
                </CardContent>
              </Card>
            ) : (
              sessions.map((session: any) => (
                <Card key={session.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedSession(session.id)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{session.classes.name}</span>
                      <Badge>{session.status}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                      </div>
                      {session.notes && (
                        <p className="text-muted-foreground">{session.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Mark Attendance</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedSession(null)}>
                    Back
                  </Button>
                  <Button onClick={() => saveAttendanceMutation.mutate()} disabled={saveAttendanceMutation.isPending}>
                    Save All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map((student: any) => (
                  <div key={student.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{student.full_name}</span>
                      </div>
                      <Button
                        size="sm"
                        className={getStatusColor(attendanceData[student.id]?.status || "Present")}
                        onClick={() => toggleStatus(student.id)}
                      >
                        {attendanceData[student.id]?.status || "Present"}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Add notes (optional)"
                      value={attendanceData[student.id]?.notes || ""}
                      onChange={(e) => updateNotes(student.id, e.target.value)}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}