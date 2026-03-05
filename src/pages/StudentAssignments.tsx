import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Star, CheckCircle2, Clock, Send, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HomeworkDetailDialog from "@/components/student/HomeworkDetailDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentCalendar } from "@/components/assignments/AssignmentCalendar";
import { useLoginChallenge } from "@/hooks/useLoginChallenge";
import { GradeCelebration } from "@/components/student/GradeCelebration";
import { getHomeworkStatus, statusConfig, getCountdown, type HomeworkStatus } from "@/lib/homeworkStatus";

const statusIcons: Record<HomeworkStatus, React.ReactNode> = {
  overdue: <AlertTriangle className="h-4 w-4 text-red-500" />,
  "due-today": <Clock className="h-4 w-4 text-amber-500" />,
  "due-soon": <Clock className="h-4 w-4 text-amber-400" />,
  submitted: <Send className="h-4 w-4 text-sky-500" />,
  graded: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  upcoming: <FileText className="h-4 w-4 text-muted-foreground" />,
};

function SubmissionPipeline({ status }: { status: HomeworkStatus }) {
  const steps = ["To Do", "Submitted", "Graded"];
  const activeIdx = status === "graded" ? 2 : status === "submitted" ? 1 : 0;
  return (
    <div className="flex items-center gap-1 mt-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div className={`h-1.5 w-6 rounded-full transition-colors ${i <= activeIdx ? "bg-emerald-500" : "bg-muted"}`} />
          {i < steps.length - 1 && <div className="h-px w-1 bg-muted" />}
        </div>
      ))}
      <span className="text-[10px] ml-1 text-muted-foreground">{steps[activeIdx]}</span>
    </div>
  );
}

function AssignmentCard({ assignment, onClick }: { assignment: any; onClick: () => void }) {
  const status = getHomeworkStatus(assignment);
  const config = statusConfig[status];
  const countdown = getCountdown(assignment.due_date);

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 ${config.cardClass} ${config.borderColor}`}
      onClick={onClick}
    >
      <CardHeader className="p-3 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{statusIcons[status]}</span>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg leading-tight break-words">
                {assignment.title}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                {assignment.classes.name}
              </CardDescription>
            </div>
            {status === "graded" && assignment.submission?.grade && (
              <div className="shrink-0 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-3 py-1.5">
                <Star className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                <span className="font-bold text-base text-emerald-700 dark:text-emerald-400">
                  {assignment.submission.grade}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={`text-[10px] sm:text-xs ${config.badgeClass}`}>
              {config.icon} {config.label}
            </Badge>
            {countdown && (
              <Badge className={`text-[10px] sm:text-xs ${config.badgeClass} ${status === "overdue" || status === "due-today" ? "animate-pulse" : ""}`}>
                {countdown}
              </Badge>
            )}
            {assignment.due_date && (
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                Due {new Date(assignment.due_date).toLocaleDateString()}
              </Badge>
            )}
          </div>

          {(status === "submitted" || status === "graded") && (
            <SubmissionPipeline status={status} />
          )}
        </div>
      </CardHeader>
      {assignment.body && status !== "graded" && (
        <CardContent className="px-3 pb-3 sm:px-5 sm:pb-4 pt-0">
          <div
            className="text-sm prose prose-sm max-w-none line-clamp-2 break-words overflow-hidden [&_img]:max-w-full [&_img]:h-auto"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.body) }}
          />
        </CardContent>
      )}
    </Card>
  );
}

export default function StudentAssignments() {
  const { studentId } = useStudentProfile();
  const [selectedHomework, setSelectedHomework] = useState<any>(null);
  const { recordHomeworkVisit } = useLoginChallenge(studentId);

  useEffect(() => {
    if (studentId) recordHomeworkVisit();
  }, [studentId]);

  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);
      return data || [];
    },
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000,
  });

  const classIds = enrollments?.map(e => e.class_id) || [];

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["student-assignments", studentId, classIds.join(",")],
    queryFn: async () => {
      if (!studentId || classIds.length === 0) return [];
      const [homeworksResult, submissionsResult] = await Promise.all([
        supabase
          .from("homeworks")
          .select(`*, classes!inner(name), homework_files(*)`)
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("homework_submissions")
          .select("*")
          .eq("student_id", studentId),
      ]);
      const homeworks = homeworksResult.data || [];
      const submissions = submissionsResult.data || [];
      const submissionMap = new Map(submissions.map(s => [s.homework_id, s]));
      return homeworks.map(hw => ({ ...hw, submission: submissionMap.get(hw.id) || null }));
    },
    enabled: !!studentId && classIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  if (!studentId) {
    return (
      <Layout title="Assignments">
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Please select a student profile</p></CardContent></Card>
      </Layout>
    );
  }

  if (isLoading) return <Layout title="Assignments">Loading...</Layout>;

  const now = new Date();
  const upcomingAssignments = assignments.filter((a: any) => !a.due_date || new Date(a.due_date) >= now);
  const pastAssignments = assignments.filter((a: any) => a.due_date && new Date(a.due_date) < now);

  return (
    <Layout title="Assignments">
      {studentId && <GradeCelebration studentId={studentId} />}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">📚 Assignments</h1>
          <p className="text-muted-foreground">Track your homework, earn XP, level up!</p>
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No assignments yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your teachers haven&apos;t posted any assignments</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-auto">
              <TabsTrigger value="list" className="text-xs sm:text-sm py-3">📋 List</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm py-3">📅 Calendar</TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs sm:text-sm py-3">🔜 Upcoming</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-6 mt-4">
              {upcomingAssignments.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">🎯 Current & Upcoming</h2>
                  <div className="grid gap-3">
                    {upcomingAssignments.map((a: any) => (
                      <AssignmentCard key={a.id} assignment={a} onClick={() => setSelectedHomework(a)} />
                    ))}
                  </div>
                </div>
              )}
              {pastAssignments.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">📁 Past Assignments</h2>
                  <div className="grid gap-3">
                    {pastAssignments.map((a: any) => {
                      const st = getHomeworkStatus(a);
                      const isOverdueNotSubmitted = st === "overdue";
                      return (
                        <div key={a.id} className={isOverdueNotSubmitted ? "" : "opacity-60 hover:opacity-90 transition-opacity"}>
                          <AssignmentCard assignment={a} onClick={() => setSelectedHomework(a)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <AssignmentCalendar
                role="student"
                onSelectAssignment={(assignment) => {
                  const hw = assignments.find((h: any) => h.id === assignment.id);
                  if (hw) setSelectedHomework(hw);
                }}
              />
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4">
              {upcomingAssignments.length === 0 ? (
                <Card><CardContent className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No upcoming assignments</p></CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {upcomingAssignments.map((a: any) => (
                    <AssignmentCard key={a.id} assignment={a} onClick={() => setSelectedHomework(a)} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {selectedHomework && studentId && (
        <HomeworkDetailDialog homework={selectedHomework} studentId={studentId} onClose={() => setSelectedHomework(null)} />
      )}
    </Layout>
  );
}
