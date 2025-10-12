import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  date_of_birth: string | null;
}

interface ProfilePickerProps {
  onSelect: (studentId: string) => void;
}

const ProfilePicker = ({ onSelect }: ProfilePickerProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFamilyStudents();
  }, []);

  const fetchFamilyStudents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get family ID from primary_user_id
      const { data: familyData } = await supabase
        .from("families")
        .select("id")
        .eq("primary_user_id", user.id)
        .single();

      if (!familyData) {
        setLoading(false);
        return;
      }

      // Get all students in this family
      const { data: studentsData } = await supabase
        .from("students")
        .select("id, full_name, date_of_birth")
        .eq("family_id", familyData.id)
        .eq("is_active", true);

      setStudents(studentsData || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Students</CardTitle>
            <CardDescription>
              Your family account is not linked to any students. Please contact the administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Select Student Profile</CardTitle>
          <CardDescription>
            Choose a student to view information and manage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {students.map((student) => (
              <Card
                key={student.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => onSelect(student.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{student.full_name}</h3>
                      {student.date_of_birth && (
                        <p className="text-sm text-muted-foreground">
                          {new Date(student.date_of_birth).toLocaleDateString("vi-VN")}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePicker;
