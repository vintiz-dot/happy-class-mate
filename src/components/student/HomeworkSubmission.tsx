import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, Heart } from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { format } from "date-fns";
import { sanitizeHtml } from "@/lib/sanitize";
import { dayjs } from "@/lib/date";
import { soundManager } from "@/lib/soundManager";

interface HomeworkSubmissionProps {
  homeworkId: string;
  studentId: string;
  existingSubmission?: any;
  onSuccess?: () => void;
}

export default function HomeworkSubmission({
  homeworkId,
  studentId,
  existingSubmission,
  onSuccess,
}: HomeworkSubmissionProps) {
  const [submissionText, setSubmissionText] = useState(
    existingSubmission?.submission_text || ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [thanked, setThanked] = useState(false);
  const queryClient = useQueryClient();

  // Check if student already thanked
  const { data: existingReaction } = useQuery({
    queryKey: ["feedback-reaction", existingSubmission?.id, studentId],
    queryFn: async () => {
      if (!existingSubmission?.id) return null;
      const { data } = await supabase
        .from("feedback_reactions")
        .select("id")
        .eq("submission_id", existingSubmission.id)
        .eq("student_id", studentId)
        .maybeSingle();
      return data;
    },
    enabled: !!existingSubmission?.id && existingSubmission?.status === "graded",
  });

  const thankMutation = useMutation({
    mutationFn: async () => {
      if (!existingSubmission?.id) return;
      await supabase.from("feedback_reactions").insert({
        submission_id: existingSubmission.id,
        student_id: studentId,
      });
    },
    onSuccess: () => {
      setThanked(true);
      soundManager.play("success");
      toast.success("💕 Thank you sent to your teacher!");
    },
    onError: () => {
      toast.error("Could not send reaction");
    },
  });

  // Fetch homework details to check due date
  const { data: homework } = useQuery({
    queryKey: ["homework-details", homeworkId],
    queryFn: async () => {
      const { data } = await supabase
        .from("homeworks")
        .select("due_date, class_id, title")
        .eq("id", homeworkId)
        .single();
      return data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      let storageKey = existingSubmission?.storage_key;
      let fileName = existingSubmission?.file_name;
      let fileSize = existingSubmission?.file_size;

      // Upload file if provided
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error("File size must be less than 5MB");
        }

        const fileExt = file.name.split(".").pop();
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `submissions/${homeworkId}/${studentId}/${timestamp}-${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        storageKey = filePath;
        fileName = file.name;
        fileSize = file.size;
      }

      // Get homework instructions to store with submission
      const { data: homeworkData } = await supabase
        .from("homeworks")
        .select("body")
        .eq("id", homeworkId)
        .single();

      // Upsert submission
      const { error } = await supabase.from("homework_submissions").upsert({
        id: existingSubmission?.id,
        homework_id: homeworkId,
        student_id: studentId,
        submission_text: submissionText || null,
        storage_key: storageKey,
        file_name: fileName,
        file_size: fileSize,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        assignment_instructions: homeworkData?.body || null,
      });

      if (error) throw error;

      // Check for early submission bonus (only for first-time submissions)
      const isFirstSubmission = !existingSubmission?.submitted_at;
      const isEarly = homework?.due_date && new Date() < new Date(homework.due_date + 'T23:59:59');
      
      if (isFirstSubmission && isEarly && homework?.class_id) {
        // Check if already received early bonus
        const { data: existingBonus } = await supabase
          .from("early_submission_rewards")
          .select("id")
          .eq("homework_id", homeworkId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (!existingBonus) {
          const effectiveDate = homework.due_date || dayjs().format("YYYY-MM-DD");
          const month = effectiveDate.slice(0, 7);

          // Insert point transaction for early submission
          const { data: pointTx } = await supabase
            .from("point_transactions")
            .insert({
              student_id: studentId,
              class_id: homework.class_id,
              homework_id: homeworkId,
              homework_title: homework.title,
              points: 5,
              type: "early_submission",
              reason: "Early submission bonus",
              date: effectiveDate,
              month
            })
            .select("id")
            .single();

          // Track the early submission reward
          await supabase
            .from("early_submission_rewards")
            .insert({
              homework_id: homeworkId,
              student_id: studentId,
              points_awarded: 5,
              point_transaction_id: pointTx?.id
            });

          toast.success("🌅 Early Bird Bonus! +5 XP");
        }
      }
    },
    onSuccess: () => {
      soundManager.play("questComplete");
      toast.success("Homework submitted successfully");
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["homework-submission", homeworkId, studentId] });
      queryClient.invalidateQueries({ queryKey: ["homework-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["student-total-points", studentId] });
      setFile(null);
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Homework submission error:", error);
      const errorMessage = error.message || "Failed to submit homework";
      
      if (errorMessage.includes("policy")) {
        toast.error("Permission denied. Please make sure you're logged in as a student.");
      } else if (errorMessage.includes("storage")) {
        toast.error("File upload failed. Please check your file and try again.");
      } else {
        toast.error(errorMessage);
      }
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const downloadFile = async () => {
    if (!existingSubmission?.storage_key) return;

    const { data, error } = await supabase.storage
      .from("homework")
      .download(existingSubmission.storage_key);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = existingSubmission.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div>
        <Label htmlFor="submission-text">Your Response</Label>
        <ReactQuill
          theme="snow"
          value={submissionText}
          onChange={setSubmissionText}
          placeholder="Write your answer here..."
          readOnly={existingSubmission?.status === "graded"}
          modules={{
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              ["link"],
              ["clean"],
            ],
          }}
        />
      </div>

      <div>
        <Label htmlFor="submission-file">Attach File (max 5MB)</Label>
        <Input
          id="submission-file"
          type="file"
          onChange={handleFileChange}
          disabled={existingSubmission?.status === "graded"}
        />
        {file && (
          <p className="text-sm text-muted-foreground mt-1">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {existingSubmission?.file_name && (
        <Button variant="outline" size="sm" onClick={downloadFile}>
          <FileText className="h-4 w-4 mr-2" />
          {existingSubmission.file_name}
        </Button>
      )}

      {existingSubmission?.status === "graded" && (
        <div className="p-4 bg-muted rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold">Grade: {existingSubmission.grade}</p>
          </div>
          
          {existingSubmission.assignment_instructions && (
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-2">Assignment Instructions:</p>
              <div 
                className="prose prose-sm max-w-none [&_p]:text-muted-foreground [&_strong]:text-foreground [&_em]:text-foreground [&_ul]:text-muted-foreground [&_ol]:text-muted-foreground [&_li]:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(existingSubmission.assignment_instructions) }}
              />
            </div>
          )}
          
          {existingSubmission.submission_text && (
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-2">Your Submission:</p>
              <div 
                className="prose prose-sm max-w-none [&_p]:text-foreground [&_strong]:text-foreground [&_em]:text-foreground [&_ul]:text-foreground [&_ol]:text-foreground [&_li]:text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(existingSubmission.submission_text) }}
              />
            </div>
          )}
          
          {existingSubmission.teacher_feedback && (
            <div className="relative border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💬</span>
                <p className="text-sm font-semibold">Teacher Feedback</p>
              </div>
              <div className="relative bg-primary/5 border border-primary/15 rounded-xl p-4 ml-2">
                {/* Speech bubble triangle */}
                <div className="absolute -left-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-primary/15 border-b-[6px] border-b-transparent" />
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {existingSubmission.teacher_feedback}
                </p>
              </div>
              {/* Thank Teacher button */}
              {!existingReaction && !thanked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 ml-2 gap-1.5 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
                  onClick={() => thankMutation.mutate()}
                  disabled={thankMutation.isPending}
                >
                  <Heart className="h-3.5 w-3.5" />
                  Thank you, Teacher!
                </Button>
              )}
              {(existingReaction || thanked) && (
                <p className="mt-2 ml-2 text-xs text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3 fill-primary text-primary" /> You thanked your teacher
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {existingSubmission?.status !== "graded" && (
        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={uploadMutation.isPending || (!submissionText && !file)}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploadMutation.isPending ? "Submitting..." : "Submit Homework"}
        </Button>
      )}
    </div>
  );
}
