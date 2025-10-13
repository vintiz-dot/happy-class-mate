import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";
import { FileText, Download, Calendar } from "lucide-react";
import { HomeworkSubmission } from "./HomeworkSubmission";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  storage_key: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  classes: {
    name: string;
  };
  teachers: {
    full_name: string;
  };
}

export function AssignmentsList() {
  const { toast } = useToast();
  const { studentId } = useStudentProfile();

  const { data: homeworkData, isLoading } = useQuery({
    queryKey: ["student-homework", studentId],
    queryFn: async () => {
      if (!studentId) return { homework: [], submissions: [] };

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map((e: any) => e.class_id) || [];

      if (classIds.length === 0) return { homework: [], submissions: [] };

      const { data: homework } = await supabase
        .from("homeworks")
        .select(`
          *,
          classes(name),
          homework_files(*)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: false, nullsFirst: false });

      const { data: submissions } = await supabase
        .from("homework_submissions")
        .select("*")
        .eq("student_id", studentId);

      return {
        homework: homework || [],
        submissions: submissions || [],
      };
    },
    enabled: !!studentId,
  });

  const homework = homeworkData?.homework || [];
  const submissions = homeworkData?.submissions || [];
  const submissionMap = new Map(submissions.map((s: any) => [s.homework_id, s]));

  const downloadTeacherFile = async (storageKey: string, fileName: string) => {
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
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!studentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Please select a student profile</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Assignments
        </CardTitle>
        <CardDescription>View and submit your class assignments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {homework.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No assignments yet</p>
        ) : (
          homework.map((hw: any) => (
            <div key={hw.id} className="p-4 border rounded-lg space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">{hw.title}</h3>
                <p className="text-sm text-muted-foreground">{hw.classes.name}</p>
              </div>

              {hw.body && (
                <p className="text-sm whitespace-pre-wrap">{hw.body}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {hw.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(hw.due_date), "MMM d, yyyy")}
                  </div>
                )}
              </div>

              {hw.homework_files?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Teacher's Files:</p>
                  {hw.homework_files.map((file: any) => (
                    <Button
                      key={file.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadTeacherFile(file.storage_key, file.file_name)}
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {file.file_name}
                    </Button>
                  ))}
                </div>
              )}

              <HomeworkSubmission
                homework={hw}
                studentId={studentId}
                existingSubmission={submissionMap.get(hw.id)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
