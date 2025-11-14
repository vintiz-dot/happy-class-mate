import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, Star } from "lucide-react";

interface HomeworkGradingListProps {
  statusFilter?: string;
}

export function HomeworkGradingList({ statusFilter = "all" }: HomeworkGradingListProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [points, setPoints] = useState("");
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["all-homework-submissions"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).single();

      if (!teacher) return [];

      // Get all classes this teacher teaches
      const { data: sessions } = await supabase.from("sessions").select("class_id").eq("teacher_id", teacher.id);

      const classIds = Array.from(new Set(sessions?.map((s) => s.class_id) || []));

      // Get all homeworks for these classes
      const { data: homeworks } = await supabase
        .from("homeworks")
        .select(
          `
          *,
          classes!inner(name)
        `,
        )
        .in("class_id", classIds);

      if (!homeworks) return [];

      // Get all submissions for these homeworks
      const homeworkIds = homeworks.map((h) => h.id);
      const { data } = await supabase
        .from("homework_submissions")
        .select(
          `
          *,
          students!inner(full_name),
          homeworks!inner(title, class_id, classes!inner(name))
        `,
        )
        .in("homework_id", homeworkIds)
        .order("submitted_at", { ascending: false });

      return data || [];
    },
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ submissionId, grade, feedback, points }: any) => {
      const { data: submission, error: fetchError } = await supabase
        .from("homework_submissions")
        .select("student_id, homework_id")
        .eq("id", submissionId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("homework_submissions")
        .update({
          grade,
          teacher_feedback: feedback,
          status: "graded",
          graded_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;

      // Create point transaction for homework (trigger will update student_points automatically)
      if (points !== undefined && points !== null) {
        const today = new Date().toISOString().split('T')[0];
        const month = new Date().toISOString().slice(0, 7);
        const pointsValue = parseInt(points);
        
        const { data: homework } = await supabase
          .from("homeworks")
          .select("class_id, title")
          .eq("id", submission.homework_id)
          .single();

        if (homework) {
          const { error: pointsError } = await supabase.from("point_transactions").insert({
            student_id: submission.student_id,
            class_id: homework.class_id,
            homework_id: submission.homework_id,
            homework_title: homework.title,
            points: pointsValue,
            type: 'homework',
            date: today,
            month,
            notes: `Homework graded: ${grade}`,
          });
          
          if (pointsError) throw pointsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-homework-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-leader"] });
      toast.success("Grade submitted successfully");
      setSelectedSubmission(null);
      setGrade("");
      setFeedback("");
      setPoints("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit grade");
    },
  });

  const downloadFile = async (storageKey: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("homework").download(storageKey);

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
      toast.error("Failed to download file");
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>;

  const filteredSubmissions = submissions.filter((submission: any) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "not_submitted") return !submission.submitted_at;
    if (statusFilter === "submitted") return submission.submitted_at && !submission.grade;
    if (statusFilter === "graded") return submission.grade !== null;
    return true;
  });

  const getStatusBadge = (submission: any) => {
    if (submission.grade !== null) {
      return <Badge className="bg-green-500 hover:bg-green-600 rounded-full">✓ Graded</Badge>;
    }
    if (submission.submitted_at) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 rounded-full">⏳ Submitted</Badge>;
    }
    return (
      <Badge variant="secondary" className="bg-gray-500 hover:bg-gray-600 rounded-full text-white">
        ○ Not Submitted
      </Badge>
    );
  };

  if (filteredSubmissions.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Star className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium mb-1">
            {statusFilter === "all" ? "No submissions yet" : `No ${statusFilter.replace("_", " ")} submissions`}
          </p>
          <p className="text-sm text-muted-foreground">Submissions will appear here once students submit their work</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3 md:space-y-4">
        {filteredSubmissions.map((submission: any) => {
          const homework = submission.homeworks;

          return (
            <Card key={submission.id} className="overflow-hidden transition-all hover:shadow-lg border-2">
              <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <CardTitle className="text-base md:text-lg line-clamp-2 flex items-start gap-2">
                      <span className="text-2xl">📚</span>
                      <span>{homework?.title}</span>
                    </CardTitle>
                    <p className="text-sm font-bold text-primary">{submission.students?.full_name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Class: {homework?.classes?.name}</p>
                    {submission.submitted_at && (
                      <p className="text-xs text-muted-foreground">
                        📅 Submitted: {format(new Date(submission.submitted_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2">{getStatusBadge(submission)}</div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3">
                {submission.submission_text && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap line-clamp-3">{submission.submission_text}</p>
                  </div>
                )}

                {submission.storage_key && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => downloadFile(submission.storage_key, submission.file_name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Attachment
                  </Button>
                )}

                {submission.grade && (
                  <div className="space-y-2 border-t pt-3 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <p className="text-sm font-bold">Grade: {submission.grade}</p>
                    </div>
                    {submission.teacher_feedback && (
                      <p className="text-sm text-muted-foreground">💬 {submission.teacher_feedback}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Graded: {format(new Date(submission.graded_at), "MMM d, yyyy")}
                    </p>
                  </div>
                )}

                {!submission.grade && submission.submitted_at && (
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full min-h-[44px] rounded-xl font-semibold"
                    onClick={() => {
                      setSelectedSubmission(submission);
                      setGrade("");
                      setFeedback("");
                      setPoints("");
                    }}
                  >
                    Grade Submission
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Grade Submission</DialogTitle>
              <p className="text-sm text-muted-foreground">{selectedSubmission.students?.full_name}</p>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Input
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., A, 95/100, Excellent"
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">Points (-100-100)</Label>
                <Input
                  id="points"
                  type="number"
                  min="-100"
                  max="100"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="For leaderboard"
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">⭐ Points will appear on the class leaderboard</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide feedback for the student..."
                  rows={4}
                  className="text-base resize-none"
                />
              </div>

              <Button
                onClick={() => {
                  if (!grade) {
                    toast.error("Please enter a grade");
                    return;
                  }
                  const pointsValue = points ? parseInt(points) : undefined;
                  if (pointsValue !== undefined && (pointsValue < -100 || pointsValue > 100)) {
                    toast.error("Points must be between 0 and 100");
                    return;
                  }
                  gradeMutation.mutate({
                    submissionId: selectedSubmission.id,
                    grade,
                    feedback,
                    points: pointsValue,
                  });
                }}
                disabled={!grade || gradeMutation.isPending}
                className="w-full min-h-[48px] text-base font-semibold rounded-xl"
              >
                {gradeMutation.isPending ? "Submitting..." : "Submit Grade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
