import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import HomeworkSubmission from "./HomeworkSubmission";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AssignmentsListProps {
  studentId: string;
}

export default function AssignmentsList({ studentId }: AssignmentsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["student-assignments", studentId],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data: homeworks } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          body,
          due_date,
          created_at,
          class_id,
          classes(name)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: true });

      // Fetch submissions for each homework
      const homeworksWithSubmissions = await Promise.all(
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

      return homeworksWithSubmissions;
    },
  });

  if (isLoading) {
    return <div>Loading assignments...</div>;
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No assignments yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {assignments?.map((assignment) => {
        const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
        const isUnsubmitted = !assignment.submission;
        const shouldHighlight = isOverdue && isUnsubmitted;
        
        return (
          <Collapsible
            key={assignment.id}
            open={expandedId === assignment.id}
            onOpenChange={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
          >
            <Card className={shouldHighlight ? "border-2 border-amber-500 bg-red-50 dark:bg-red-950/20" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg">{assignment.title}</CardTitle>
                  <CardDescription>{(assignment.classes as any)?.name}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {assignment.submission && (
                    <Badge variant={assignment.submission.status === "graded" ? "default" : "secondary"}>
                      {assignment.submission.status}
                    </Badge>
                  )}
                  <Badge variant={assignment.due_date && new Date(assignment.due_date) < new Date() ? "destructive" : "secondary"}>
                    {assignment.due_date ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due {format(new Date(assignment.due_date), "MMM d, yyyy")}
                      </span>
                    ) : (
                      "No due date"
                    )}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignment.body && (
                <div 
                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.body) }}
                />
              )}
              
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  {expandedId === assignment.id ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Hide Submission
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      {assignment.submission ? "View Submission" : "Submit Homework"}
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <HomeworkSubmission
                  homeworkId={assignment.id}
                  studentId={studentId}
                  existingSubmission={assignment.submission}
                />
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
        );
      })}
    </div>
  );
}
