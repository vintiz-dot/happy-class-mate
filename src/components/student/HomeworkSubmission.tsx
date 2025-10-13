import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HomeworkSubmissionProps {
  homework: any;
  studentId: string;
  existingSubmission?: any;
}

export function HomeworkSubmission({ homework, studentId, existingSubmission }: HomeworkSubmissionProps) {
  const [open, setOpen] = useState(false);
  const [submissionText, setSubmissionText] = useState(existingSubmission?.submission_text || "");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      let storageKey = existingSubmission?.storage_key;
      let fileName = existingSubmission?.file_name;
      let fileSize = existingSubmission?.file_size;

      if (file) {
        const fileExt = file.name.split(".").pop();
        storageKey = `${studentId}/${homework.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(storageKey, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        fileName = file.name;
        fileSize = file.size;
      }

      const { error } = await supabase
        .from("homework_submissions")
        .upsert({
          homework_id: homework.id,
          student_id: studentId,
          submission_text: submissionText,
          storage_key: storageKey,
          file_name: fileName,
          file_size: fileSize,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-homework"] });
      setOpen(false);
      setSubmissionText("");
      setFile(null);
      toast({ title: "Homework submitted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting homework",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "outline", label: "Not Submitted" },
      submitted: { variant: "default", label: "Submitted" },
      graded: { variant: "secondary", label: "Graded" },
      redo: { variant: "destructive", label: "Needs Revision" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

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
      toast({
        title: "Error downloading file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {getStatusBadge(existingSubmission?.status || "pending")}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant={existingSubmission ? "outline" : "default"}>
              {existingSubmission ? "Update Submission" : "Submit Homework"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Submit Homework</DialogTitle>
              <DialogDescription>{homework.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text">Your Answer</Label>
                <Textarea
                  id="text"
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Attach File (Optional, Max 5MB)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      if (selectedFile.size > 5 * 1024 * 1024) {
                        toast({
                          title: "File too large",
                          description: "Maximum file size is 5MB",
                          variant: "destructive",
                        });
                        return;
                      }
                      setFile(selectedFile);
                    }
                  }}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!submissionText && !file || submitMutation.isPending}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Submit Homework
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {existingSubmission && (
        <div className="space-y-2 text-sm">
          {existingSubmission.grade && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Grade: {existingSubmission.grade}</p>
              {existingSubmission.teacher_feedback && (
                <p className="text-muted-foreground mt-1">{existingSubmission.teacher_feedback}</p>
              )}
            </div>
          )}
          {existingSubmission.storage_key && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => downloadFile(existingSubmission.storage_key, existingSubmission.file_name)}
            >
              <FileText className="h-4 w-4 mr-2" />
              View Your Submission
            </Button>
          )}
        </div>
      )}
    </div>
  );
}