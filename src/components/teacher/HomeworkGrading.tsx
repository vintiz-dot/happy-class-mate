import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const { data: homework } = useQuery({
    queryKey: ["homework-detail", homeworkId],
    queryFn: async () => {
      const { data, error } = await supabase.from("homeworks").select("*, classes(id)").eq("id", homeworkId).single();

      if (error) throw error;
      return data;
    },
    enabled: !!homeworkId,
  });

  const { data: enrolledStudents } = useQuery({
    queryKey: ["homework-enrolled-students", homework?.classes?.id],
    queryFn: async () => {
      if (!homework?.classes?.id) return [];

      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, students(id, full_name)")
        .eq("class_id", homework.classes.id)
        .is("end_date", null);

      if (error) throw error;
      return data?.map((e) => e.students).filter(Boolean) || [];
    },
    enabled: !!homework?.classes?.id,
  });

  const { data: submissions } = useQuery({
    queryKey: ["homework-submissions", homeworkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homework_submissions")
        .select(
          `
          *,
          students!inner(full_name)
        `,
        )
        .eq("homework_id", homeworkId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!homeworkId,
  });

  // Combine enrolled students with their submissions
  const studentsWithSubmissions =
    enrolledStudents?.map((student) => {
      const submission = submissions?.find((s) => s.student_id === student.id);
      return { student, submission };
    }) || [];

  const gradeMutation = useMutation({
    mutationFn: async ({ submissionId, studentId, grade, feedback, points }: any) => {
      let finalSubmissionId = submissionId;

      // If no submission exists, create one
      if (!submissionId && studentId) {
        const { data: newSubmission, error: createError } = await supabase
          .from("homework_submissions")
          .insert({
            homework_id: homeworkId,
            student_id: studentId,
            status: "graded",
            grade,
            teacher_feedback: feedback,
            graded_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        finalSubmissionId = newSubmission.id;
      } else if (submissionId) {
        // Update existing submission
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
      }

      const targetStudentId =
        studentId ||
        (await supabase.from("homework_submissions").select("student_id").eq("id", finalSubmissionId).single()).data
          ?.student_id;

      // Update or create student points for homework
      if (points !== undefined && points !== null && homework?.classes?.id) {
        const month = new Date().toISOString().slice(0, 7);

        const { error: pointsError } = await supabase.from("student_points").upsert(
          {
            student_id: targetStudentId,
            class_id: homework.classes.id,
            month,
            homework_points: points,
          },
          {
            onConflict: "student_id,class_id,month",
          },
        );

        if (pointsError) throw pointsError;
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

  const handleGradeSubmit = () => {
    if (!selectedSubmission) return;

    const pointsValue = points !== "" ? Number(points) : undefined;
    if (pointsValue !== undefined && (pointsValue < -100 || pointsValue > 100)) {
      toast.error("Points must be between -100 and 100");
      return;
    }

    gradeMutation.mutate({
      submissionId: selectedSubmission.submission?.id,
      studentId: selectedSubmission.student.id,
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
      not_submitted: "bg-gray-100 text-gray-800",
      Not_Submitted: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100";
  };

  return (
    <>
      <Dialog open={!!homeworkId} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Homework Submissions</DialogTitle>
            <DialogDescription>Review and grade student submissions</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {studentsWithSubmissions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No enrolled students</p>
            ) : (
              studentsWithSubmissions.map((item: any) => (
                <div
                  key={item.student.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.student.full_name}</p>
                      {item.submission ? (
                        <p className="text-sm text-muted-foreground">
                          Submitted {dayjs(item.submission.submitted_at).format("MMM D, YYYY h:mm A")}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not submitted</p>
                      )}
                    </div>
                    <Badge className={statusColor(item.submission?.status || "not_submitted")}>
                      {item.submission?.status || "Not Submitted"}
                    </Badge>
                  </div>

                  {item.submission?.submission_text && (
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="text-sm whitespace-pre-wrap">{item.submission.submission_text}</p>
                    </div>
                  )}

                  {item.submission?.storage_key && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(item.submission.storage_key, item.submission.file_name)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Attachment
                    </Button>
                  )}

                  {item.submission?.status === "graded" && (
                    <div className="space-y-2 border-t pt-3">
                      <div>
                        <p className="text-sm font-medium">Grade: {item.submission.grade}</p>
                        {item.submission.teacher_feedback && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Feedback: {item.submission.teacher_feedback}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Graded {dayjs(item.submission.graded_at).format("MMM D, YYYY")}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant={item.submission?.status === "graded" ? "outline" : "default"}
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedSubmission(item);
                        setGrade(item.submission?.grade || "");
                        setFeedback(item.submission?.teacher_feedback || "");
                        setPoints("");
                      }}
                    >
                      {item.submission?.status === "graded" ? "Update Grade" : "Grade Assignment"}
                    </Button>
                    {!item.submission && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedSubmission(item);
                          setGrade("");
                          setFeedback("");
                          setPoints("");
                        }}
                      >
                        Grade Offline Submission
                      </Button>
                    )}
                  </div>
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
              <DialogTitle>Grade Assignment</DialogTitle>
              <DialogDescription>
                {selectedSubmission.student.full_name}
                {!selectedSubmission.submission && " (Offline Submission)"}
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
                <Label htmlFor="points">Points (-100-100)</Label>
                <Input
                  id="points"
                  type="number"
                  min="-100"
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

              <Button onClick={handleGradeSubmit} disabled={!grade || gradeMutation.isPending} className="w-full">
                Submit Grade
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
