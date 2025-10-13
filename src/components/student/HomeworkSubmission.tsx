import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";

interface HomeworkSubmissionProps {
  homeworkId: string;
  studentId: string;
  existingSubmission?: any;
}

export default function HomeworkSubmission({
  homeworkId,
  studentId,
  existingSubmission,
}: HomeworkSubmissionProps) {
  const [submissionText, setSubmissionText] = useState(
    existingSubmission?.submission_text || ""
  );
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

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
        const filePath = `homework-submissions/${studentId}/${homeworkId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        storageKey = filePath;
        fileName = file.name;
        fileSize = file.size;
      }

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
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Homework submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      setFile(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit homework");
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
        <Textarea
          id="submission-text"
          value={submissionText}
          onChange={(e) => setSubmissionText(e.target.value)}
          placeholder="Write your answer here..."
          rows={6}
          disabled={existingSubmission?.status === "graded"}
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
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Grade: {existingSubmission.grade}</p>
          {existingSubmission.teacher_feedback && (
            <p className="text-sm text-muted-foreground mt-1">
              Feedback: {existingSubmission.teacher_feedback}
            </p>
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
