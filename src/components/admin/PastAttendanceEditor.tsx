import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Save, Users } from "lucide-react";
import { format } from "date-fns";

interface PastAttendanceEditorProps {
  classId: string;
}

export function PastAttendanceEditor({ classId }: PastAttendanceEditorProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [attendance, setAttendance] = useState<Record<string, Record<string, string>>>({});
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["past-attendance-sessions", classId, selectedMonth],
    queryFn: async () => {
      const startDate = `${selectedMonth}-01`;
      const monthEnd = new Date(Date.UTC(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0))
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from("sessions")
        .select(
          `
          id,
          date,
          start_time,
          end_time,
          status,
          attendance (
            id,
            student_id,
            status,
            students (id, full_name)
          )
        `,
        )
        .eq("class_id", classId)
        .gte("date", startDate)
        .lte("date", monthEnd)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async ({ sessionId, studentId, status }: { sessionId: string; studentId: string; status: string }) => {
      const { error } = await supabase.functions.invoke("mark-attendance", {
        body: {
          sessionId,
          studentId,
          status,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["past-attendance-sessions", classId, selectedMonth] });
      toast.success("Attendance updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update attendance");
    },
  });

  const handleSaveAll = async () => {
    try {
      const updates = [];
      for (const [sessionId, studentStatuses] of Object.entries(attendance)) {
        for (const [studentId, status] of Object.entries(studentStatuses)) {
          updates.push(saveAttendanceMutation.mutateAsync({ sessionId, studentId, status }));
        }
      }
      await Promise.all(updates);
      setAttendance({});
      toast.success("All attendance saved");
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  };

  const toggleAttendance = (sessionId: string, studentId: string, currentStatus: string) => {
    const statuses = ["Present", "Absent", "Excused"];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    setAttendance((prev) => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        [studentId]: nextStatus,
      },
    }));
  };

  const attendanceColor = (status: string) => {
    const colors: Record<string, string> = {
      Present: "bg-green-100 text-green-800 hover:bg-green-200",
      Absent: "bg-red-100 text-red-800 hover:bg-red-200",
      Excused: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    };
    return colors[status] || "bg-gray-100";
  };

  const hasChanges = Object.keys(attendance).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Past Attendance Editor
        </CardTitle>
        <CardDescription>View and edit past attendance records for this class</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="month-select">Select Month</Label>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  const monthValue = format(date, "yyyy-MM");
                  return (
                    <SelectItem key={monthValue} value={monthValue}>
                      {format(date, "MMMM yyyy")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {hasChanges && (
              <Button onClick={handleSaveAll}>
                <Save className="h-4 w-4 mr-2" />
                Save All
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-4">
            {sessions.map((session: any) => (
              <Card key={session.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <p className="font-medium">{format(new Date(session.date), "EEEE, MMM d, yyyy")}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                      </p>
                    </div>
                    <Badge variant={session.status === "Held" ? "default" : "secondary"}>{session.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {session.attendance && session.attendance.length > 0 ? (
                    <div className="space-y-2">
                      {session.attendance.map((att: any) => {
                        const currentStatus = attendance[session.id]?.[att.student_id] || att.status;
                        return (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                          >
                            <span className="font-medium">{att.students?.full_name}</span>
                            <Badge
                              className={`cursor-pointer ${attendanceColor(currentStatus)}`}
                              onClick={() => toggleAttendance(session.id, att.student_id, currentStatus)}
                            >
                              {currentStatus}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attendance records</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">No sessions found for this month</div>
        )}
      </CardContent>
    </Card>
  );
}
