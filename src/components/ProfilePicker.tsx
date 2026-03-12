import { useEffect, useState, useRef } from "react";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePicker() {
  const { studentId, setStudentId } = useStudentProfile();
  const [students, setStudents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminOrTeacher, setIsAdminOrTeacher] = useState(false);
  const hasAutoSelectedRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function loadStudents() {
      hasAutoSelectedRef.current = false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Skip for admin/teacher roles — they don't have student profiles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roleNames = roles?.map(r => r.role) || [];
        if (roleNames.includes("admin") || roleNames.includes("teacher")) {
          setIsAdminOrTeacher(true);
          setLoading(false);
          return;
        }

        // Get students linked to user or in their family
        const { data: familyData } = await supabase
          .from("families")
          .select("id")
          .eq("primary_user_id", user.id)
          .maybeSingle();

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
        
        // Auto-select logic with ref to prevent multiple runs
        if (studentData && studentData.length === 1 && !hasAutoSelectedRef.current) {
          hasAutoSelectedRef.current = true;
          setStudentId(studentData[0].id);
          // Invalidate on auto-selection
          queryClient.invalidateQueries({ queryKey: ["assignment-calendar"] });
          queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
        } else if (studentData && studentData.length > 0) {
          // Check if current studentId is valid
          const isValidStudentId = studentData.some(s => s.id === studentId);
          if (!isValidStudentId && studentId) {
            // Clear invalid studentId
            setStudentId(undefined);
          }
        }
      } catch (error) {
        console.error("Error loading students:", error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }

    loadStudents();

    // Listen for auth state changes to reset on logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setStudents(null);
        setLoading(false);
        setIsAdminOrTeacher(false);
        hasAutoSelectedRef.current = false;
      } else if (event === 'SIGNED_IN') {
        loadStudents();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  // Skip for admin/teacher users
  if (isAdminOrTeacher) return null;

  // No linked students — show "pending setup" message
  if (!students || students.length === 0) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <Card className="w-[420px]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 text-4xl">🔗</div>
            <CardTitle>Account Not Linked Yet</CardTitle>
            <CardDescription>
              Your account hasn't been connected to a student profile yet. Please contact the administrator to get set up — it only takes a moment!
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Single student or already selected — hide picker
  if (students.length < 2 || studentId) {
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
              onClick={() => {
                setStudentId(student.id);
                queryClient.invalidateQueries({ queryKey: ["assignment-calendar"] });
                queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
              }}
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
