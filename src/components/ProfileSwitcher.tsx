import { useEffect, useState } from "react";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, ChevronDown } from "lucide-react";

export default function ProfileSwitcher() {
  const { studentId, setStudentId } = useStudentProfile();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudents() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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

  if (loading || students.length === 0) {
    return null;
  }

  const currentStudent = students.find(s => s.id === studentId);

  if (students.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm bg-muted/50 rounded-md">
        <User className="h-4 w-4" />
        <span>{currentStudent?.full_name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          <span>{currentStudent?.full_name || "Select Student"}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {students.map((student) => (
          <DropdownMenuItem
            key={student.id}
            onClick={() => setStudentId(student.id)}
            className={studentId === student.id ? "bg-muted" : ""}
          >
            <div className="flex flex-col">
              <span className="font-medium">{student.full_name}</span>
              {student.date_of_birth && (
                <span className="text-xs text-muted-foreground">
                  DOB: {new Date(student.date_of_birth).toLocaleDateString()}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
