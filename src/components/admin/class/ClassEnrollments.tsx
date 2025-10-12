import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";

const ClassEnrollments = ({ classId }: { classId: string }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [enrolling, setEnrolling] = useState(false);

  const { data: enrollments, refetch: refetchEnrollments } = useQuery({
    queryKey: ["class-enrollments", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          students(id, full_name)
        `)
        .eq("class_id", classId)
        .is("end_date", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: availableStudents } = useQuery({
    queryKey: ["available-students", classId],
    queryFn: async () => {
      // Get all active students
      const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (studentsError) throw studentsError;

      // Get currently enrolled student IDs
      const enrolledIds = enrollments?.map((e) => e.student_id) || [];

      // Filter out enrolled students
      return allStudents?.filter((s) => !enrolledIds.includes(s.id)) || [];
    },
    enabled: !!enrollments,
  });

  const handleBulkEnroll = async () => {
    if (selected.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    setEnrolling(true);
    try {
      const enrollmentData = selected.map((studentId) => ({
        class_id: classId,
        student_id: studentId,
        start_date: startDate,
      }));

      const { error } = await supabase.from("enrollments").insert(enrollmentData);

      if (error) throw error;

      toast.success(`Successfully enrolled ${selected.length} student(s)`);
      setSelected([]);
      refetchEnrollments();
    } catch (error: any) {
      console.error("Error enrolling students:", error);
      toast.error(error.message || "Failed to enroll students");
    } finally {
      setEnrolling(false);
    }
  };

  const handleToggle = (studentId: string) => {
    setSelected((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {enrollments?.map((enrollment) => (
              <div key={enrollment.id} className="flex items-center justify-between p-2 border rounded">
                <span>{enrollment.students?.full_name}</span>
                <span className="text-sm text-muted-foreground">
                  Since {format(new Date(enrollment.start_date), "MMM dd, yyyy")}
                </span>
              </div>
            ))}
            {!enrollments?.length && (
              <p className="text-muted-foreground text-center py-4">No enrollments yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Enroll Students</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Students</Label>
            <div className="border rounded p-4 max-h-64 overflow-auto space-y-2">
              {availableStudents?.map((student) => (
                <div key={student.id} className="flex items-center gap-2">
                  <Checkbox
                    id={student.id}
                    checked={selected.includes(student.id)}
                    onCheckedChange={() => handleToggle(student.id)}
                  />
                  <label htmlFor={student.id} className="cursor-pointer flex-1">
                    {student.full_name}
                  </label>
                </div>
              ))}
              {!availableStudents?.length && (
                <p className="text-muted-foreground text-center">
                  All active students are already enrolled
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleBulkEnroll}
            disabled={enrolling || selected.length === 0}
            className="w-full"
          >
            {enrolling ? "Enrolling..." : `Enroll ${selected.length} Student(s)`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassEnrollments;
