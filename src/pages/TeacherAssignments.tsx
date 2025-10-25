import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
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
import { Plus, FileText, Upload, Edit, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { HomeworkGrading } from "@/components/teacher/HomeworkGrading";

export default function TeacherAssignments() {
  const [open, setOpen] = useState(false);
  const [gradingHomeworkId, setGradingHomeworkId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  const handleEdit = (assignment: any) => {
    setEditingId(assignment.id);
    setTitle(assignment.title);
    setBody(assignment.body || "");
    setDueDate(assignment.due_date || "");
    setSelectedClass(assignment.class_id);
    setOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setDueDate("");
    setSelectedClass("");
    setFiles([]);
  };

  const createAssignment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !title || !selectedClass) return;

      if (editingId) {
        // Update existing homework
        const { error } = await supabase
          .from("homeworks")
          .update({
            title,
            body,
            due_date: dueDate || null,
          })
          .eq("id", editingId);

        if (error) throw error;
        return;
      }

      // Create new homework
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
      handleCancelEdit();
      toast({ title: editingId ? "Assignment updated successfully" : "Assignment created successfully" });
    },
    onError: (error) => {
      toast({
        title: editingId ? "Error updating assignment" : "Error creating assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (homeworkId: string) => {
      const { error } = await supabase
        .from("homeworks")
        .delete()
        .eq("id", homeworkId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Assignment deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting assignment",
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Assignment" : "Create New Assignment"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Update the assignment details" : "Add a new assignment for your class"}
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
                  <div className="min-h-[200px]">
                    <ReactQuill
                      theme="snow"
                      value={body}
                      onChange={setBody}
                      placeholder="Assignment description and instructions"
                      modules={{
                        toolbar: [
                          [{ header: [1, 2, 3, false] }],
                          ["bold", "italic", "underline", "strike"],
                          [{ list: "ordered" }, { list: "bullet" }],
                          ["link", "image"],
                          ["clean"],
                        ],
                      }}
                      className="h-[150px]"
                    />
                  </div>
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

                <div className="flex gap-2 pt-8">
                  <Button
                    onClick={() => createAssignment.mutate()}
                    disabled={!title || !selectedClass || createAssignment.isPending}
                    className="flex-1"
                  >
                    {editingId ? "Update Assignment" : "Create Assignment"}
                  </Button>
                  {editingId && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setOpen(false);
                        handleCancelEdit();
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
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
                    <div className="flex-1">
                      <CardTitle>{assignment.title}</CardTitle>
                      <CardDescription>
                        {assignment.classes.name}
                        {assignment.due_date && ` • Due ${new Date(assignment.due_date).toLocaleDateString()}`}
                        {assignment.created_at && ` • Created ${new Date(assignment.created_at).toLocaleDateString()}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(assignment)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGradingHomeworkId(assignment.id)}
                      >
                        View Submissions
                      </Button>
                    </div>
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

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this assignment? This action cannot be undone and will also delete all student submissions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteAssignment.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
