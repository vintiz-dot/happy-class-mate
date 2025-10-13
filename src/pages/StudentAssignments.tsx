import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HomeworkDetailDialog from "@/components/student/HomeworkDetailDialog";

export default function StudentAssignments() {
  const { studentId } = useStudentProfile();
  const [selectedHomework, setSelectedHomework] = useState<any>(null);

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

      const { data: homeworks } = await supabase
        .from("homeworks")
        .select(`
          *,
          classes!inner(name),
          homework_files(*)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: true, nullsFirst: false });

      // Get submission status for each homework
      const homeworksWithStatus = await Promise.all(
        (homeworks || []).map(async (hw) => {
          const { data: submission } = await supabase
            .from("homework_submissions")
            .select("id, status")
            .eq("homework_id", hw.id)
            .eq("student_id", studentId)
            .maybeSingle();

          return { ...hw, submissionStatus: submission?.status };
        })
      );

      return homeworksWithStatus;
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
                    <Card 
                      key={assignment.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedHomework(assignment)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle>{assignment.title}</CardTitle>
                            <CardDescription>
                              {assignment.classes.name}
                              {assignment.created_at && ` • Created ${new Date(assignment.created_at).toLocaleDateString()}`}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {assignment.submissionStatus === "graded" && (
                              <Badge className="bg-green-100 text-green-800">Graded</Badge>
                            )}
                            {assignment.submissionStatus === "submitted" && (
                              <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>
                            )}
                            {!assignment.submissionStatus && (
                              <Badge variant="outline">Not Submitted</Badge>
                            )}
                            {assignment.due_date && (
                              <Badge variant="outline">
                                Due {new Date(assignment.due_date).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {assignment.body && (
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap line-clamp-3">{assignment.body}</p>
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
                    <Card 
                      key={assignment.id} 
                      className="opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedHomework(assignment)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle>{assignment.title}</CardTitle>
                            <CardDescription>
                              {assignment.classes.name}
                              {assignment.created_at && ` • Created ${new Date(assignment.created_at).toLocaleDateString()}`}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {assignment.submissionStatus === "graded" && (
                              <Badge className="bg-green-100 text-green-800">Graded</Badge>
                            )}
                            {assignment.submissionStatus === "submitted" && (
                              <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>
                            )}
                            {assignment.due_date && (
                              <Badge variant="secondary">
                                Due {new Date(assignment.due_date).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
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

      {selectedHomework && studentId && (
        <HomeworkDetailDialog
          homework={selectedHomework}
          studentId={studentId}
          onClose={() => setSelectedHomework(null)}
        />
      )}
    </Layout>
  );
}
