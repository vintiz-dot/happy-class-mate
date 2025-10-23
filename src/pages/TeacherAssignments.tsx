import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HomeworkGrading } from "@/components/teacher/HomeworkGrading";

export default function TeacherAssignments() {
  const [open, setOpen] = useState(false);
  const [gradingHomeworkId, setGradingHomeworkId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({
    queryKey: ["teacher-classes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) throw new Error("Not a teacher");

      const { data } = await supabase
        .from("sessions")
        .select(`
          class_id,
          classes!inner(id, name)
        `)
        .eq("teacher_id", teacher.id)
        .order("classes(name)");

      const uniqueClasses = Array.from(
        new Map((data || []).map(s => [s.class_id, s.classes])).values()
      );

      return uniqueClasses;
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) return [];

      const classIds = await supabase
        .from("sessions")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      const uniqueClassIds = Array.from(new Set(classIds.data?.map(s => s.class_id) || []));

      const { data } = await supabase
        .from("homeworks")
        .select(`
          *,
          classes!inner(name),
          homework_files(*)
        `)
        .in("class_id", uniqueClassIds)
        .order("due_date", { ascending: false, nullsFirst: false });

      return data || [];
    },
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !title || !selectedClass) return;

      const { data: homework, error: hwError } = await supabase
        .from("homeworks")
        .insert({
          title,
          body,
          due_date: dueDate || null,
          class_id: selectedClass,
          created_by: user.id,
        })
        .select()
        .single();

      if (hwError) throw hwError;

      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${homework.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("homework")
            .upload(fileName, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) throw uploadError;

          await supabase.from("homework_files").insert({
            homework_id: homework.id,
            storage_key: fileName,
            file_name: file.name,
            size_bytes: file.size,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      setOpen(false);
      setTitle("");
      setBody("");
      setDueDate("");
      setSelectedClass("");
      setFiles([]);
      toast({ title: "Assignment created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error creating assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Layout title="Assignments">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-muted-foreground">Create and manage class assignments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
                <DialogDescription>
                  Add a new assignment for your class
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="class">Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Assignment title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Description</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Assignment description and instructions"
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="files">Attachments (Max 5MB per file)</Label>
                  <Input
                    id="files"
                    type="file"
                    multiple
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.target.files || []);
                      const validFiles = selectedFiles.filter(f => f.size <= 5 * 1024 * 1024);
                      if (validFiles.length !== selectedFiles.length) {
                        toast({
                          title: "Some files were too large",
                          description: "Maximum file size is 5MB",
                          variant: "destructive",
                        });
                      }
                      setFiles(validFiles);
                    }}
                  />
                  {files.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {files.length} file(s) selected
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => createAssignment.mutate()}
                  disabled={!title || !selectedClass || createAssignment.isPending}
                  className="w-full"
                >
                  Create Assignment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assignments yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first assignment to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            assignments.map((assignment: any) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{assignment.title}</CardTitle>
                      <CardDescription>
                        {assignment.classes.name}
                        {assignment.due_date && ` • Due ${new Date(assignment.due_date).toLocaleDateString()}`}
                        {assignment.created_at && ` • Created ${new Date(assignment.created_at).toLocaleDateString()}`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGradingHomeworkId(assignment.id)}
                    >
                      View Submissions
                    </Button>
                  </div>
                </CardHeader>
                {assignment.body && (
                  <CardContent>
                    <div 
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: assignment.body }}
                    />
                    {assignment.homework_files?.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-medium">Attachments:</p>
                        {assignment.homework_files.map((file: any) => (
                          <div key={file.id} className="text-sm text-muted-foreground flex items-center gap-2">
                            <Upload className="h-3 w-3" />
                            {file.file_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {gradingHomeworkId && (
          <HomeworkGrading
            homeworkId={gradingHomeworkId}
            onClose={() => setGradingHomeworkId(null)}
          />
        )}
      </div>
    </Layout>
  );
}
