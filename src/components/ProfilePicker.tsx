import { useEffect, useState } from "react";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePicker() {
  const { studentId, setStudentId } = useStudentProfile();
  const [students, setStudents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudents() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get students linked to user or in their family
        const { data: familyData } = await supabase
          .from("families")
          .select("id")
          .eq("primary_user_id", user.id)
          .single();

        let studentData;
        if (familyData) {
          const { data } = await supabase
            .from("students")
            .select("id, full_name, date_of_birth")
            .eq("family_id", familyData.id)
            .eq("is_active", true)
            .order("full_name");
          studentData = data;
        } else {
          const { data } = await supabase
            .from("students")
            .select("id, full_name, date_of_birth")
            .eq("linked_user_id", user.id)
            .eq("is_active", true)
            .order("full_name");
          studentData = data;
        }

        setStudents(studentData || []);
        
        if (studentData && studentData.length === 1 && !studentId) {
          setStudentId(studentData[0].id);
        }
      } catch (error) {
        console.error("Error loading students:", error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, [studentId, setStudentId]);

  if (loading || !students || students.length < 2 || studentId) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Select Student Profile</CardTitle>
          <CardDescription>
            This account has multiple students. Please select one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {students.map((student) => (
            <Button
              key={student.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => setStudentId(student.id)}
            >
              <div className="text-left">
                <div className="font-medium">{student.full_name}</div>
                {student.date_of_birth && (
                  <div className="text-xs text-muted-foreground">
                    DOB: {new Date(student.date_of_birth).toLocaleDateString()}
                  </div>
                )}
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
