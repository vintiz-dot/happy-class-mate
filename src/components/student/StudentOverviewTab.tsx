import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StudentEditDrawer } from "@/components/admin/StudentEditDrawer";
import { ClassLeaderboardShared } from "@/components/shared/ClassLeaderboardShared";
import { Users } from "lucide-react";

export function StudentOverviewTab({ student }: { student: any }) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Fetch family and siblings
  const { data: familyData } = useQuery({
    queryKey: ["student-family", student.id],
    queryFn: async () => {
      if (!student.family_id) return null;
      
      const { data, error } = await supabase
        .from("families")
        .select(`
          id,
          name,
          students(id, full_name)
        `)
        .eq("id", student.family_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!student.family_id,
  });

  // Fetch student's enrolled classes
  const { data: enrolledClasses } = useQuery({
    queryKey: ["student-enrolled-classes", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name)")
        .eq("student_id", student.id)
        .not("end_date", "lt", new Date().toISOString().split("T")[0]);

      if (error) throw error;
      return data?.map(e => e.classes).filter(Boolean) || [];
    },
  });

  return (
    <>
      {/* Class Leaderboards - Show full leaderboard like admin view */}
      {enrolledClasses && enrolledClasses.length > 0 && (
        <div className="space-y-6">
          {enrolledClasses.map((cls: any) => (
            <ClassLeaderboardShared key={cls.id} classId={cls.id} />
          ))}
        </div>
      )}

      {/* Family & Siblings Card */}
      {familyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Family Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Family</p>
              <p className="font-medium">{familyData.name}</p>
            </div>
            
            {familyData.students && familyData.students.length > 1 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Siblings</p>
                <div className="flex flex-wrap gap-2">
                  {familyData.students
                    .filter((s: any) => s.id !== student.id)
                    .map((sibling: any) => (
                      <Badge key={sibling.id} variant="outline">
                        {sibling.full_name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{student.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{student.email || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{student.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
              <p className="font-medium">
                {student.date_of_birth ? format(new Date(student.date_of_birth), "MMM d, yyyy") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={student.is_active ? "default" : "secondary"}>
                {student.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {student.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{student.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          {student.enrollments && student.enrollments.length > 0 ? (
            <div className="space-y-3">
              {student.enrollments.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{enrollment.class?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Teacher: {enrollment.class?.default_teacher?.full_name || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(enrollment.start_date), "MMM d, yyyy")} 
                      {enrollment.end_date && ` - ${format(new Date(enrollment.end_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {enrollment.class?.session_rate_vnd?.toLocaleString("vi-VN")} ₫
                    </p>
                    {enrollment.discount_type && (
                      <Badge variant="secondary" className="text-xs">
                        {enrollment.discount_type === "percent" ? `${enrollment.discount_value}%` : `${enrollment.discount_value?.toLocaleString("vi-VN")} ₫`} 
                        {" "}off - {enrollment.discount_cadence}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active enrollments</p>
          )}
        </CardContent>
      </Card>

      <StudentEditDrawer
        student={student}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}