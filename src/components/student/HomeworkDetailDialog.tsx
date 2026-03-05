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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <div className="space-y-3">
            <DialogTitle className="text-lg sm:text-xl leading-tight break-words">{homework.title}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs">{homework.classes.name}</Badge>
              {homework.created_at && (
                <span className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {format(new Date(homework.created_at), "MMM d, yyyy")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge()}
              {homework.due_date && (
                <Badge variant="outline" className="text-xs">
                  Due {format(new Date(homework.due_date), "MMM d, yyyy")}
                </Badge>
              )}
              {homework.due_date && (() => {
                const now = new Date();
                const due = new Date(homework.due_date);
                const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (diff > 0 && diff <= 7 && !submission) {
                  return (
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs animate-pulse">
                      ⏰ {diff} day{diff > 1 ? "s" : ""} left
                    </Badge>
                  );
                }
                if (diff <= 0 && !submission) {
                  return (
                    <Badge variant="destructive" className="text-xs">
                      ⚠️ Overdue
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {homework.body && (
            <div className="bg-primary/5 border-2 border-primary/20 p-3 sm:p-6 rounded-lg overflow-hidden">
              <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 text-primary flex items-center gap-2">
                📋 Assignment Instructions
              </h2>
              <div 
                className="prose prose-sm max-w-none w-full min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] [&_*]:max-w-full [&_*]:[overflow-wrap:anywhere] [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-foreground [&_p]:break-words [&_strong]:text-foreground [&_em]:text-foreground [&_ul]:text-foreground [&_ol]:text-foreground [&_li]:text-foreground [&_img]:max-w-full [&_img]:h-auto [&_a]:break-all [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(homework.body) }}
              />
            </div>
          )}

          {homework.homework_files?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">📎 Attachments</h3>
              <div className="space-y-1">
                {homework.homework_files.map((file: any) => (
                  <Button
                    key={file.id}
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(file.storage_key, file.file_name)}
                    className="w-full justify-start text-xs sm:text-sm"
                  >
                    <Download className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">{file.file_name}</span>
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
