import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";
import { FileText, Download, Calendar } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  storage_key: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  classes: {
    name: string;
  };
  teachers: {
    full_name: string;
  };
}

export function AssignmentsList() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get student's enrolled classes
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("linked_user_id", user.user.id)
        .single();

      if (!studentData) return;

      const { data: enrollments } = await supabase
        .from("enrollments" as any)
        .select("class_id")
        .eq("student_id", studentData.id)
        .is("end_date", null);

      const classIds = enrollments?.map((e: any) => e.class_id) || [];

      if (classIds.length === 0) {
        setAssignments([]);
        return;
      }

      const { data, error } = await supabase
        .from("assignments" as any)
        .select(`
          *,
          classes(name),
          teachers(full_name)
        `)
        .in("class_id", classIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (storageKey: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("assignments")
        .download(storageKey);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return isPast(new Date(dueDate));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Assignments
        </CardTitle>
        <CardDescription>View and download your class assignments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No assignments yet</p>
        ) : (
          assignments.map(assignment => (
            <div key={assignment.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold">{assignment.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {assignment.classes.name} • {assignment.teachers.full_name}
                  </p>
                </div>
                {assignment.due_date && (
                  <Badge variant={isOverdue(assignment.due_date) ? "destructive" : "default"}>
                    {isOverdue(assignment.due_date) ? "Overdue" : "Due Soon"}
                  </Badge>
                )}
              </div>

              {assignment.description && (
                <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {assignment.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(assignment.due_date), "MMM d, yyyy")}
                  </div>
                )}
                <div>
                  Posted: {format(new Date(assignment.created_at), "MMM d, yyyy")}
                </div>
              </div>

              {assignment.storage_key && assignment.file_name && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(assignment.storage_key!, assignment.file_name!)}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download {assignment.file_name}
                  {assignment.file_size && (
                    <span className="ml-2 text-muted-foreground">
                      ({(assignment.file_size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
