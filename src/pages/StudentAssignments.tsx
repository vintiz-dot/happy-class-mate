import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Star, CheckCircle2, Clock, Send, AlertTriangle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HomeworkDetailDialog from "@/components/student/HomeworkDetailDialog";
import HomeworkStreakCard from "@/components/student/HomeworkStreakCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentCalendar } from "@/components/assignments/AssignmentCalendar";
import { useLoginChallenge } from "@/hooks/useLoginChallenge";
import { GradeCelebration } from "@/components/student/GradeCelebration";
import { getHomeworkStatus, statusConfig, getCountdown, type HomeworkStatus } from "@/lib/homeworkStatus";
import { motion } from "framer-motion";
import { HomeworkPdfDownload } from "@/components/homework/HomeworkPdfDownload";

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
          <motion.div
            className={`h-1.5 w-6 rounded-full transition-colors ${i <= activeIdx ? "bg-emerald-500" : "bg-muted"}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.15, duration: 0.3 }}
          />
          {i < steps.length - 1 && <div className="h-px w-1 bg-muted" />}
        </div>
      ))}
      <span className="text-[10px] ml-1 text-muted-foreground">{steps[activeIdx]}</span>
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: "easeOut" as const,
    },
  }),
};

function AssignmentCard({ assignment, onClick, index = 0 }: { assignment: any; onClick: () => void; index?: number }) {
  const status = getHomeworkStatus(assignment);
  const config = statusConfig[status];
  const countdown = getCountdown(assignment.due_date);
  const isOverdue = status === "overdue";

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.015, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow duration-200 min-w-0 overflow-hidden ${config.cardClass} ${config.borderColor} ${isOverdue ? "ring-1 ring-red-500/30 shadow-[0_0_0_1px_hsl(0_84%_60%/0.15)]" : ""}`}
        onClick={onClick}
      >
        <CardHeader className="p-3 sm:p-5 min-w-0 overflow-hidden">
          <div className="space-y-2 min-w-0">
            <div className="flex items-start gap-2 min-w-0">
              <span className="mt-0.5 shrink-0 relative">
                {statusIcons[status]}
                {isOverdue && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                )}
              </span>
              <div className="flex-1 min-w-0 overflow-hidden">
                <CardTitle className="text-base sm:text-lg leading-tight break-words [overflow-wrap:anywhere]">
                  {assignment.title}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5 break-words">
                  {assignment.classes.name}
                </CardDescription>
              </div>
              {status === "graded" && assignment.submission?.grade && (
                <motion.div
                  className="shrink-0 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-3 py-1.5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
                >
                  <Star className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                  <span className="font-bold text-base text-emerald-700 dark:text-emerald-400">
                    {assignment.submission.grade}
                  </span>
                </motion.div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Badge className={`text-[10px] sm:text-xs ${config.badgeClass}`}>
                {config.icon} {config.label}
              </Badge>
              {countdown && (
                <Badge className={`text-[10px] sm:text-xs ${config.badgeClass} inline-flex items-center gap-1`}>
                  {isOverdue && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" style={{ animationDuration: "2.8s" }} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                  )}
                  {countdown}
                </Badge>
              )}
              {assignment.due_date && (
                <Badge variant="outline" className="text-[10px] sm:text-xs">
                  Due {new Date(assignment.due_date).toLocaleDateString()}
                </Badge>
              )}
            </div>

            {/* Prominent PDF download — its own row so it never gets pushed off-screen */}
            <div onClick={(e) => e.stopPropagation()} className="pt-1">
              <HomeworkPdfDownload
                homework={assignment}
                className={assignment.classes?.name}
                variant="pill-compact"
              />
            </div>

            {(status === "submitted" || status === "graded") && (
              <SubmissionPipeline status={status} />
            )}
          </div>
        </CardHeader>
        {assignment.body && status !== "graded" && (
          <CardContent className="px-3 pb-3 sm:px-5 sm:pb-4 pt-0 min-w-0 overflow-hidden">
            <div
              className="text-sm prose prose-sm rich-content max-w-none w-full min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere] overflow-hidden [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.body) }}
            />
          </CardContent>
        )}
      </Card>
    </motion.div>
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
      <div className="space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="px-1"
        >
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">📚 Assignments</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Track your homework, earn XP, level up!</p>
        </motion.div>

        {/* Homework Streak Tracker */}
        {assignments.length > 0 && studentId && (
          <HomeworkStreakCard studentId={studentId} assignments={assignments} />
        )}

        {assignments.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assignments yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your teachers haven&apos;t posted any assignments</p>
              </CardContent>
            </Card>
          </motion.div>
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
                    {upcomingAssignments.map((a: any, i: number) => (
                      <div key={a.id} className="long-list-item">
                        <AssignmentCard assignment={a} index={i} onClick={() => setSelectedHomework(a)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pastAssignments.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">📁 Past Assignments</h2>
                  <div className="grid gap-3">
                    {pastAssignments.map((a: any, i: number) => {
                      const st = getHomeworkStatus(a);
                      const isOverdueNotSubmitted = st === "overdue";
                      return (
                        <div key={a.id} className={`long-list-item ${isOverdueNotSubmitted ? "" : "opacity-60 hover:opacity-90 transition-opacity"}`}>
                          <AssignmentCard assignment={a} index={i} onClick={() => setSelectedHomework(a)} />
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
                  {upcomingAssignments.map((a: any, i: number) => (
                    <AssignmentCard key={a.id} assignment={a} index={i} onClick={() => setSelectedHomework(a)} />
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
