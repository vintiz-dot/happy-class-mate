import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StudentsListProps {
  searchQuery?: string;
  sortBy?: string;
  filterClass?: string;
}

export function StudentsList({ searchQuery = "", sortBy = "name-asc", filterClass = "all" }: StudentsListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const { data: students, isLoading } = useQuery({
    queryKey: ["students-list", searchQuery, sortBy, filterClass],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select(`
          *,
          families:family_id(name),
          enrollments!inner(class_id, start_date, classes(name))
        `)
        .eq("is_active", true);

      // Apply class filter
      if (filterClass && filterClass !== "all") {
        query = query.eq("enrollments.class_id", filterClass);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching students:", error);
        throw error;
      }

      // Client-side filtering
      let filtered = data || [];

      // Search filter
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.full_name?.toLowerCase().includes(lower) ||
            s.email?.toLowerCase().includes(lower) ||
            (s.families as any)?.name?.toLowerCase().includes(lower) ||
            s.id?.toLowerCase().includes(lower)
        );
      }

      // Sort
      if (sortBy === "name-asc") {
        filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
      } else if (sortBy === "name-desc") {
        filtered.sort((a, b) => b.full_name.localeCompare(a.full_name));
      } else if (sortBy === "updated") {
        filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      } else if (sortBy === "enrollment") {
        filtered.sort((a, b) => {
          const aDate = (a.enrollments as any)?.[0]?.start_date || "9999-12-31";
          const bDate = (b.enrollments as any)?.[0]?.start_date || "9999-12-31";
          return bDate.localeCompare(aDate);
        });
      }

      return filtered;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from("students")
        .update({ is_active: false })
        .eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      toast.success("Student deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete student: " + error.message);
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
          All Students ({students?.length || 0})
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
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{student.full_name}</p>
                    <Badge variant={student.is_active ? "default" : "secondary"}>
                      {student.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {(student.enrollments as any)?.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      📚 Classes: {(student.enrollments as any).map((e: any) => e.classes?.name).filter(Boolean).join(", ")}
                    </p>
                  )}
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/students/${student.id}`)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Student</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {student.full_name}? This will mark them as inactive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(student.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
