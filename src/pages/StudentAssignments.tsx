import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HomeworkDetailDialog from "@/components/student/HomeworkDetailDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentCalendar } from "@/components/assignments/AssignmentCalendar";
import { useLoginChallenge } from "@/hooks/useLoginChallenge";

export default function StudentAssignments() {
  const { studentId } = useStudentProfile();
  const [selectedHomework, setSelectedHomework] = useState<any>(null);
  const { recordHomeworkVisit } = useLoginChallenge(studentId);

  // Auto-award daily XP when student visits assignments page
  useEffect(() => {
    if (studentId) {
      recordHomeworkVisit();
    }
  }, [studentId]);

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
        .order("created_at", { ascending: false });

      // Get submission data for each homework
      const homeworksWithStatus = await Promise.all(
        (homeworks || []).map(async (hw) => {
          const { data: submission } = await supabase
            .from("homework_submissions")
            .select("*")
            .eq("homework_id", hw.id)
            .eq("student_id", studentId)
            .maybeSingle();

          return { ...hw, submission };
        })
      );

      return homeworksWithStatus;
    },
    enabled: !!studentId,
  });

  // Helper function to get card background color based on status
  const getCardStatusClass = (assignment: any) => {
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const submission = assignment.submission;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Not submitted and late - HOT RED (check this FIRST before graded status)
    if (!submission && dueDate) {
      const dueDay = new Date(dueDate);
      dueDay.setHours(0, 0, 0, 0);
      
      if (dueDay < today) {
        return "bg-red-500/20 dark:bg-red-500/15 border-red-500/50 dark:border-red-500/40 backdrop-blur-sm";
      }
      
      // Due today - AMBER
      if (dueDay.getTime() === today.getTime()) {
        return "bg-amber-500/20 dark:bg-amber-500/15 border-amber-500/50 dark:border-amber-500/40 backdrop-blur-sm";
      }
    }
    
    // Graded - green
    if (submission?.status === "graded") {
      return "bg-success/10 dark:bg-success/5 border-success/30 dark:border-success/20 backdrop-blur-sm";
    }
    
    // Submitted but not graded
    if (submission?.status === "submitted") {
      return "bg-primary/5 dark:bg-primary/5 border-primary/20 dark:border-primary/20 backdrop-blur-sm";
    }
    
    // Future assignments - no background color
    return "glass-sm";
  };

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
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-auto">
              <TabsTrigger value="list" className="text-xs sm:text-sm py-3">
                List View
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm py-3">
                Calendar
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs sm:text-sm py-3">
                Upcoming
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4 md:space-y-6 mt-4">
              {upcomingAssignments.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Current & Upcoming</h2>
                <div className="grid gap-4">
                  {upcomingAssignments.map((assignment: any) => (
                    <Card 
                      key={assignment.id} 
                      className={`cursor-pointer hover:shadow-lg transition-shadow ${getCardStatusClass(assignment)}`}
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
                            {assignment.submission?.status === "graded" && assignment.submission.grade && (
                              <Badge variant="default" className="bg-emerald-600">
                                {assignment.submission.grade}
                              </Badge>
                            )}
                            {assignment.submission?.status === "graded" && (
                              <Badge className="bg-green-100 text-green-800">Graded</Badge>
                            )}
                            {assignment.submission?.status === "submitted" && (
                              <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>
                            )}
                            {!assignment.submission && (
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
                          <div 
                            className="text-sm prose prose-sm max-w-none line-clamp-3"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.body) }}
                          />
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
                  {pastAssignments.map((assignment: any) => {
                    const isOverdueNotSubmitted = !assignment.submission && assignment.due_date && new Date(assignment.due_date) < new Date();
                    const cardOpacity = isOverdueNotSubmitted ? "" : "opacity-60 hover:opacity-80";
                    
                    return (
                    <Card 
                      key={assignment.id} 
                      className={`cursor-pointer transition-opacity ${cardOpacity} ${getCardStatusClass(assignment)}`}
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
                            {assignment.submission?.status === "graded" && assignment.submission.grade && (
                              <Badge variant="default" className="bg-emerald-600">
                                {assignment.submission.grade}
                              </Badge>
                            )}
                            {assignment.submission?.status === "graded" && (
                              <Badge className="bg-green-100 text-green-800">Graded</Badge>
                            )}
                            {assignment.submission?.status === "submitted" && (
                              <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>
                            )}
                            {!assignment.submission && (
                              <Badge variant="destructive">Not Submitted</Badge>
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
                  );
                  })}
                </div>
              </div>
            )}
            </TabsContent>

            <TabsContent value="calendar" className="space-y-4 md:space-y-6 mt-4">
              <AssignmentCalendar 
                role="student"
                onSelectAssignment={(assignment) => {
                  const hw = assignments.find((h: any) => h.id === assignment.id);
                  if (hw) setSelectedHomework(hw);
                }}
              />
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4 md:space-y-6 mt-4">
              {upcomingAssignments.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No upcoming assignments</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {upcomingAssignments.map((assignment: any) => (
                    <Card 
                      key={assignment.id} 
                      className={`cursor-pointer hover:shadow-lg transition-shadow ${getCardStatusClass(assignment)}`}
                      onClick={() => setSelectedHomework(assignment)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle>{assignment.title}</CardTitle>
                            <CardDescription>
                              {assignment.classes.name}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {assignment.submission?.status === "graded" && assignment.submission.grade && (
                              <Badge variant="default" className="bg-success">
                                {assignment.submission.grade}
                              </Badge>
                            )}
                            {assignment.submission?.status === "graded" && (
                              <Badge className="bg-success text-success-foreground">Graded</Badge>
                            )}
                            {assignment.submission?.status === "submitted" && (
                              <Badge className="bg-primary text-primary-foreground">Submitted</Badge>
                            )}
                            {!assignment.submission && (
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
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
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
