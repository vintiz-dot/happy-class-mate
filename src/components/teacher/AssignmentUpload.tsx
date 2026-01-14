import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Eye, Calendar, FileText, Edit, Users, Loader2 } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { EditHomeworkDialog } from "./EditHomeworkDialog";
import { GradeOfflineDialog } from "./GradeOfflineDialog";

interface Class {
  id: string;
  name: string;
}

interface Homework {
  id: string;
  title: string;
  body: string | null;
  due_date: string | null;
  created_at: string;
  class_id: string;
  classes: { name: string };
  homework_files: Array<{ file_name: string; storage_key: string }>;
}

interface AssignmentUploadProps {
  classFilter?: string;
}

// Single query to get teacher data and classes
async function fetchTeacherData() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.user.id)
    .single();

  if (!teacher) throw new Error("Teacher not found");

  const { data: classData } = await supabase
    .from("sessions")
    .select("class_id, classes(id, name)")
    .eq("teacher_id", teacher.id);

  const uniqueClasses = Array.from(
    new Map(classData?.map(s => [s.classes?.id, s.classes]).filter(([id]) => id) as [string, Class][])
  ).map(([_, cls]) => cls);

  return { teacherId: teacher.id, classes: uniqueClasses };
}

// Fetch homeworks for teacher's classes
async function fetchHomeworks(classIds: string[]) {
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("homeworks")
    .select("id, title, body, due_date, created_at, class_id, classes(name), homework_files(file_name, storage_key)")
    .in("class_id", classIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as Homework[];
}

export function AssignmentUpload({ classFilter }: AssignmentUploadProps) {
  const [formData, setFormData] = useState({
    class_id: "",
    title: "",
    description: "",
    due_date: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [editingHomeworkId, setEditingHomeworkId] = useState<string | null>(null);
  const [gradingHomeworkId, setGradingHomeworkId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Single query for teacher data
  const { data: teacherData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teacher-data"],
    queryFn: fetchTeacherData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const classIds = teacherData?.classes.map(c => c.id) || [];

  // Fetch homeworks only when we have class IDs
  const { data: homeworks = [], isLoading: homeworksLoading } = useQuery({
    queryKey: ["teacher-homeworks", classIds],
    queryFn: () => fetchHomeworks(classIds),
    enabled: classIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const isLoading = teacherLoading || homeworksLoading;

  // Create homework mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: homework, error: insertError } = await supabase
        .from("homeworks")
        .insert({
          class_id: formData.class_id,
          title: formData.title,
          body: formData.description || null,
          due_date: formData.due_date || null,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (file && homework) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${homework.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: fileError } = await supabase
          .from("homework_files")
          .insert({
            homework_id: homework.id,
            file_name: file.name,
            storage_key: fileName,
            size_bytes: file.size,
          });

        if (fileError) throw fileError;
      }

      return homework;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Assignment uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["teacher-homeworks"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["class-homeworks"] });
      setFormData({ class_id: "", title: "", description: "", due_date: "" });
      setFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.class_id || !formData.title) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createMutation.mutate();
  };

  const viewFile = async (storageKey: string) => {
    try {
      const { data } = await supabase.storage.from("homework").getPublicUrl(storageKey);
      window.open(data.publicUrl, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredHomeworks = classFilter && classFilter !== "all"
    ? homeworks.filter(hw => hw.class_id === classFilter)
    : homeworks;

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload New Assignment
          </CardTitle>
          <CardDescription>Create a new assignment for your students</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="class">Class *</Label>
              <Select
                value={formData.class_id}
                onValueChange={(value) => setFormData({ ...formData, class_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {(teacherData?.classes || []).map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Assignment title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Assignment instructions and details..."
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link", "image"],
                    ["clean"],
                  ],
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Attachment (max 5MB)</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept="*/*"
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <Button type="submit" disabled={createMutation.isPending} className="w-full min-h-[44px]">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Assignment"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Assignments */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Assignments
          </CardTitle>
          <CardDescription>View all assignments you've created</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading assignments...
            </div>
          ) : filteredHomeworks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No assignments yet. Create one above!</p>
          ) : (
            <div className="space-y-4">
              {filteredHomeworks.map((hw) => (
                <Card key={hw.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base md:text-lg truncate">{hw.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {hw.classes.name}
                          </Badge>
                          {hw.due_date && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {format(new Date(hw.due_date), "MMM dd, yyyy")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {hw.body && (
                      <div 
                        className="text-sm text-muted-foreground line-clamp-2 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(hw.body) }}
                      />
                    )}

                    {hw.homework_files && hw.homework_files.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {hw.homework_files.map((file, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => viewFile(file.storage_key)}
                            className="text-xs min-h-[36px]"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {file.file_name}
                          </Button>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Created: {format(new Date(hw.created_at), "MMM dd, yyyy 'at' h:mm a")}
                    </p>

                    <div className="flex gap-2 pt-2 border-t mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingHomeworkId(hw.id)}
                        className="flex-1 min-h-[40px]"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setGradingHomeworkId(hw.id)}
                        className="flex-1 min-h-[40px]"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Grade Offline
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditHomeworkDialog
        homeworkId={editingHomeworkId}
        isOpen={!!editingHomeworkId}
        onClose={() => setEditingHomeworkId(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["teacher-homeworks"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
        }}
      />

      <GradeOfflineDialog
        homeworkId={gradingHomeworkId}
        isOpen={!!gradingHomeworkId}
        onClose={() => setGradingHomeworkId(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["homework-submissions"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
        }}
      />
    </div>
  );
}
