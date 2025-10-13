import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { dayjs } from "@/lib/date";

interface HomeworkGradingProps {
  homeworkId: string;
  onClose: () => void;
}

export function HomeworkGrading({ homeworkId, onClose }: HomeworkGradingProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [points, setPoints] = useState("");
  const queryClient = useQueryClient();

  const { data: submissions } = useQuery({
    queryKey: ["homework-submissions", homeworkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homework_submissions")
        .select(`
          *,
          students!inner(full_name)
        `)
        .eq("homework_id", homeworkId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!homeworkId,
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ submissionId, grade, feedback, points }: any) => {
      const { data: submission, error: fetchError } = await supabase
        .from("homework_submissions")
        .select("student_id, homework_id")
        .eq("id", submissionId)
        .single();

      if (fetchError) throw fetchError;

      // Update submission with grade
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

      // Update or create student points for homework
      if (points !== undefined && points !== null) {
        const month = new Date().toISOString().slice(0, 7);
        
        // Get class_id from homework
        const { data: homework } = await supabase
          .from("homeworks")
          .select("class_id")
          .eq("id", submission.homework_id)
          .single();

        if (homework) {
          const { error: pointsError } = await supabase
            .from("student_points")
            .upsert({
              student_id: submission.student_id,
              class_id: homework.class_id,
              month,
              homework_points: points,
            }, {
              onConflict: "student_id,class_id,month",
            });

          if (pointsError) throw pointsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework-submissions", homeworkId] });
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard"] });
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
      const { data, error } = await supabase.storage
        .from("homework")
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
      toast.error("Failed to download file");
    }
  };

  const handleGradeSubmit = () => {
    if (!selectedSubmission) return;

    const pointsValue = points ? parseInt(points) : undefined;
    if (pointsValue !== undefined && (pointsValue < 0 || pointsValue > 100)) {
      toast.error("Points must be between 0 and 100");
      return;
    }

    gradeMutation.mutate({
      submissionId: selectedSubmission.id,
      grade,
      feedback,
      points: pointsValue,
    });
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      submitted: "bg-blue-100 text-blue-800",
      graded: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100";
  };

  return (
    <>
      <Dialog open={!!homeworkId} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Homework Submissions</DialogTitle>
            <DialogDescription>
              Review and grade student submissions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {submissions?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No submissions yet
              </p>
            ) : (
              submissions?.map((submission: any) => (
                <div
                  key={submission.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{submission.students.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted {dayjs(submission.submitted_at).format("MMM D, YYYY h:mm A")}
                      </p>
                    </div>
                    <Badge className={statusColor(submission.status)}>
                      {submission.status}
                    </Badge>
                  </div>

                  {submission.submission_text && (
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="text-sm whitespace-pre-wrap">{submission.submission_text}</p>
                    </div>
                  )}

                  {submission.storage_key && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(submission.storage_key, submission.file_name)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Attachment
                    </Button>
                  )}

                  {submission.status === "graded" && (
                    <div className="space-y-2 border-t pt-3">
                      <div>
                        <p className="text-sm font-medium">Grade: {submission.grade}</p>
                        {submission.teacher_feedback && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Feedback: {submission.teacher_feedback}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Graded {dayjs(submission.graded_at).format("MMM D, YYYY")}
                        </p>
                      </div>
                    </div>
                  )}

                  {submission.status !== "graded" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedSubmission(submission);
                        setGrade(submission.grade || "");
                        setFeedback(submission.teacher_feedback || "");
                        setPoints("");
                      }}
                    >
                      Grade Submission
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSubmission && (
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grade Submission</DialogTitle>
              <DialogDescription>
                {selectedSubmission.students.full_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grade">Grade</Label>
                <Input
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., A, 95/100, Excellent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">Points (0-100)</Label>
                <Input
                  id="points"
                  type="number"
                  min="0"
                  max="100"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="Enter points for leaderboard (max 100)"
                />
                <p className="text-xs text-muted-foreground">
                  These points will be added to the student's homework score on the leaderboard
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide feedback for the student..."
                  rows={4}
                />
              </div>

              <Button
                onClick={handleGradeSubmit}
                disabled={!grade || gradeMutation.isPending}
                className="w-full"
              >
                Submit Grade
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
