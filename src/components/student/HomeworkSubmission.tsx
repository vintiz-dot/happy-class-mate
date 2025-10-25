import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

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
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `homework-submissions/${studentId}/${timestamp}-${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

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
      queryClient.invalidateQueries({ queryKey: ["homework-submission", homeworkId, studentId] });
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
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">Grade: {existingSubmission.grade}</p>
          {existingSubmission.teacher_feedback && (
            <div>
              <p className="text-sm font-medium">Feedback:</p>
              <p className="text-sm text-muted-foreground mt-1">
                {existingSubmission.teacher_feedback}
              </p>
            </div>
          )}
          {existingSubmission.submission_text && (
            <div>
              <p className="text-sm font-medium">Your Submission:</p>
              <div 
                className="text-sm text-muted-foreground mt-1 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: existingSubmission.submission_text }}
              />
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
