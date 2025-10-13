import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StudentAssignments() {
  const { studentId } = useStudentProfile();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["student-assignments", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      if (!enrollments || enrollments.length === 0) return [];

      const classIds = enrollments.map(e => e.class_id);

      const { data } = await supabase
        .from("homeworks")
        .select(`
          *,
          classes!inner(name),
          homework_files(*)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: true, nullsFirst: false });

      return data || [];
    },
    enabled: !!studentId,
  });

  const downloadFile = async (storageKey: string, fileName: string) => {
    const { data } = await supabase.storage
      .from("homework")
      .download(storageKey);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!studentId) {
    return (
      <Layout title="Assignments">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please select a student profile</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (isLoading) {
    return <Layout title="Assignments">Loading...</Layout>;
  }

  const now = new Date();
  const upcomingAssignments = assignments.filter((a: any) => 
    !a.due_date || new Date(a.due_date) >= now
  );
  const pastAssignments = assignments.filter((a: any) => 
    a.due_date && new Date(a.due_date) < now
  );

  return (
    <Layout title="Assignments">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">View your class assignments</p>
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No assignments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your teachers haven't posted any assignments
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {upcomingAssignments.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Current & Upcoming</h2>
                <div className="grid gap-4">
                  {upcomingAssignments.map((assignment: any) => (
                    <Card key={assignment.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle>{assignment.title}</CardTitle>
                            <CardDescription>
                              {assignment.classes.name}
                              {assignment.created_at && ` • Created ${new Date(assignment.created_at).toLocaleDateString()}`}
                            </CardDescription>
                          </div>
                          {assignment.due_date && (
                            <Badge variant="outline">
                              Due {new Date(assignment.due_date).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      {assignment.body && (
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap mb-4">{assignment.body}</p>
                          {assignment.homework_files?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Attachments:</p>
                              <div className="space-y-1">
                                {assignment.homework_files.map((file: any) => (
                                  <Button
                                    key={file.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadFile(file.storage_key, file.file_name)}
                                    className="w-full justify-start"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    {file.file_name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {pastAssignments.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Past Assignments</h2>
                <div className="grid gap-4">
                  {pastAssignments.map((assignment: any) => (
                    <Card key={assignment.id} className="opacity-60">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle>{assignment.title}</CardTitle>
                            <CardDescription>
                              {assignment.classes.name}
                              {assignment.created_at && ` • Created ${new Date(assignment.created_at).toLocaleDateString()}`}
                            </CardDescription>
                          </div>
                          {assignment.due_date && (
                            <Badge variant="secondary">
                              Due {new Date(assignment.due_date).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
