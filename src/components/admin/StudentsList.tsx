import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";

export function StudentsList() {
  const { data: students, isLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          families:family_id (name)
        `)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading students...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          All Students
        </CardTitle>
        <CardDescription>Manage your student records</CardDescription>
      </CardHeader>
      <CardContent>
        {students?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No students found</p>
        ) : (
          <div className="space-y-3">
            {students?.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{student.full_name}</p>
                    <Badge variant={student.is_active ? "default" : "secondary"}>
                      {student.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {student.email && (
                    <p className="text-sm text-muted-foreground">✉️ {student.email}</p>
                  )}
                  {student.phone && (
                    <p className="text-sm text-muted-foreground">📱 {student.phone}</p>
                  )}
                  {student.families && (
                    <p className="text-sm text-muted-foreground">
                      👨‍👩‍👧 Family: {(student.families as any).name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
