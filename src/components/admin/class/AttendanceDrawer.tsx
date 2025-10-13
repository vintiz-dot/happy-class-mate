import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Save } from "lucide-react";
import { toast } from "sonner";
import { dayjs } from "@/lib/date";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceDrawerProps {
  session: any;
  onClose: () => void;
}

const AttendanceDrawer = ({ session, onClose }: AttendanceDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const { data: students } = useQuery({
    queryKey: ["session-students", session?.id],
    queryFn: async () => {
      if (!session?.class_id) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students!inner(id, full_name)
        `)
        .eq("class_id", session.class_id)
        .is("end_date", null);

      const studentsWithAttendance = await Promise.all(
        (enrollments || []).map(async (enrollment: any) => {
          const { data: attendanceRecord } = await supabase
            .from("attendance")
            .select("status")
            .eq("session_id", session.id)
            .eq("student_id", enrollment.student_id)
            .maybeSingle();

          return {
            id: enrollment.student_id,
            full_name: enrollment.students.full_name,
            status: attendanceRecord?.status || "Present",
          };
        })
      );

      return studentsWithAttendance;
    },
    enabled: !!session?.id,
  });

  useEffect(() => {
    if (students) {
      const attendanceMap: Record<string, string> = {};
      students.forEach((student: any) => {
        attendanceMap[student.id] = student.status;
      });
      setAttendance(attendanceMap);
    }
  }, [students]);

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      const { error } = await supabase.functions.invoke("mark-attendance", {
        body: {
          sessionId: session.id,
          studentId,
          status,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-students", session?.id] });
      toast.success("Attendance saved");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save attendance");
    },
  });

  const saveAllAttendance = async () => {
    try {
      for (const [studentId, status] of Object.entries(attendance)) {
        await markAttendanceMutation.mutateAsync({ studentId, status });
      }
      onClose();
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  };

  const toggleAttendance = (studentId: string) => {
    const statuses = ["Present", "Absent", "Excused"];
    const currentIndex = statuses.indexOf(attendance[studentId] || "Present");
    const nextIndex = (currentIndex + 1) % statuses.length;
    setAttendance((prev) => ({
      ...prev,
      [studentId]: statuses[nextIndex],
    }));
  };

  const filteredStudents = students?.filter((s: any) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const attendanceColor = (status: string) => {
    const colors: Record<string, string> = {
      Present: "bg-green-100 text-green-800 hover:bg-green-200",
      Absent: "bg-red-100 text-red-800 hover:bg-red-200",
      Excused: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    };
    return colors[status] || "bg-gray-100";
  };

  // Check if teacher can edit (24 hour window)
  const sessionEnd = dayjs(`${session.date} ${session.end_time}`);
  const canTeacherEdit = dayjs().diff(sessionEnd, "hour") <= 24;
  const canEdit = role === "admin" || (role === "teacher" && canTeacherEdit);

  return (
    <Sheet open={!!session} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Mark Attendance</SheetTitle>
          <SheetDescription>
            {session.class_name || "Session"} • {dayjs(session.date).format("MMM D, YYYY")} • {session.start_time?.slice(0, 5)}
          </SheetDescription>
        </SheetHeader>

        {!canEdit && (
          <div className="my-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            {role === "teacher" 
              ? "Editing window closed (24 hours after session end)"
              : "You don't have permission to edit attendance"}
          </div>
        )}

        <div className="space-y-4 mt-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="space-y-2">
            {filteredStudents?.map((student: any) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <span className="font-medium">{student.full_name}</span>
                <Badge
                  className={`cursor-pointer ${attendanceColor(attendance[student.id])} ${!canEdit && "cursor-not-allowed opacity-70"}`}
                  onClick={() => canEdit && toggleAttendance(student.id)}
                >
                  {attendance[student.id]}
                </Badge>
              </div>
            ))}
          </div>

          {canEdit && (
            <Button
              onClick={saveAllAttendance}
              disabled={markAttendanceMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Save All Attendance
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AttendanceDrawer;
