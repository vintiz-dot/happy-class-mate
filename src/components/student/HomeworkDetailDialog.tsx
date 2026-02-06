import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar } from "lucide-react";
import HomeworkSubmission from "./HomeworkSubmission";
import { format } from "date-fns";
import { sanitizeHtml } from "@/lib/sanitize";

interface HomeworkDetailDialogProps {
  homework: any;
  studentId: string;
  isReadOnly?: boolean; // True when viewing a classmate's homework
  onClose: () => void;
}

export default function HomeworkDetailDialog({ homework, studentId, isReadOnly = false, onClose }: HomeworkDetailDialogProps) {
  const { data: submission } = useQuery({
    queryKey: ["homework-submission", homework.id, studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("homework_submissions")
        .select("*")
        .eq("homework_id", homework.id)
        .eq("student_id", studentId)
        .maybeSingle();
      
      return data;
    },
  });

  const downloadFile = async (storageKey: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("homework")
        .createSignedUrl(storageKey, 3600); // 1 hour expiry
      
      if (error) throw error;
      if (data?.signedUrl) {
        // Open in new tab - browser will handle download based on content type
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      console.error("Error downloading file:", error);
    }
  };

  const getStatusBadge = () => {
    if (submission?.status === "graded") {
      return <Badge className="bg-green-100 text-green-800">Graded</Badge>;
    }
    if (submission?.status === "submitted") {
      return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
    }
    return <Badge variant="outline">Not Submitted</Badge>;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle>{homework.title}</DialogTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{homework.classes.name}</span>
                {homework.created_at && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Created {format(new Date(homework.created_at), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {homework.due_date && (
                <Badge variant="outline">
                  Due {format(new Date(homework.due_date), "MMM d, yyyy")}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {homework.body && (
            <div className="bg-primary/5 border-2 border-primary/20 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4 text-primary">Assignment Instructions</h2>
              <div 
                className="prose prose-sm max-w-none [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-foreground [&_strong]:text-foreground [&_em]:text-foreground [&_ul]:text-foreground [&_ol]:text-foreground [&_li]:text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(homework.body) }}
              />
            </div>
          )}

          {homework.homework_files?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Teacher's Attachments</h3>
              <div className="space-y-1">
                {homework.homework_files.map((file: any) => (
                  <Button
                    key={file.id}
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(file.storage_key, file.file_name)}
                    className="w-full justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {file.file_name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">
              {isReadOnly ? "Classmate's Submission" : "Your Submission"}
            </h3>
            {isReadOnly ? (
              <div className="p-4 border rounded-lg space-y-3">
                {submission ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {submission.status === "graded" ? (
                        <span className="text-sm font-medium text-green-600">Graded - {submission.grade}</span>
                      ) : submission.status === "submitted" ? (
                        <span className="text-sm font-medium text-blue-600">Submitted</span>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">Pending</span>
                      )}
                    </div>
                    {submission.submitted_at && (
                      <p className="text-sm text-muted-foreground">
                        Submitted: {format(new Date(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    This classmate has not submitted yet.
                  </p>
                )}
              </div>
            ) : (
              <HomeworkSubmission
                homeworkId={homework.id}
                studentId={studentId}
                existingSubmission={submission}
                onSuccess={onClose}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
