import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Eye, Calendar, FileText } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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
  classes: { name: string };
  homework_files: Array<{ file_name: string; storage_key: string }>;
}

export function AssignmentUpload() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [formData, setFormData] = useState({
    class_id: "",
    title: "",
    description: "",
    due_date: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadTeacherClasses();
    loadHomeworks();
  }, []);

  const loadTeacherClasses = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.user.id)
        .single();

      if (!teacher) return;
      setTeacherId(teacher.id);

      const { data: classData } = await supabase
        .from("sessions")
        .select("class_id, classes(id, name)")
        .eq("teacher_id", teacher.id);

      // Get unique classes
      const uniqueClasses = Array.from(
        new Map(classData?.map(s => [s.classes?.id, s.classes]).filter(([id]) => id) as [string, Class][])
      ).map(([_, cls]) => cls);

      setClasses(uniqueClasses);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadHomeworks = async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.user.id)
        .single();

      if (!teacher) return;

      // Get all classes taught by this teacher
      const { data: teacherClasses } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      const classIds = [...new Set(teacherClasses?.map(s => s.class_id) || [])];

      // Load homeworks for those classes
      const { data, error } = await supabase
        .from("homeworks")
        .select("id, title, body, due_date, created_at, classes(name), homework_files(file_name, storage_key)")
        .in("class_id", classIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHomeworks(data as unknown as Homework[]);
    } catch (error: any) {
      toast({
        title: "Error loading assignments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.class_id || !formData.title) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Create homework record
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

      // Upload file if present
      if (file && homework) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${homework.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Create homework_files record
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

      toast({
        title: "Success",
        description: "Assignment uploaded successfully",
      });

      // Invalidate queries and reload
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["class-homeworks"] });
      loadHomeworks();

      // Reset form
      setFormData({
        class_id: "",
        title: "",
        description: "",
        due_date: "",
      });
      setFile(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const viewFile = async (storageKey: string) => {
    try {
      const { data } = await supabase.storage.from("homework").getPublicUrl(storageKey);
      window.open(data.publicUrl, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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
                  {classes.map(cls => (
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

            <Button type="submit" disabled={uploading} className="w-full min-h-[44px]">
              {uploading ? "Uploading..." : "Upload Assignment"}
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
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading assignments...</p>
          ) : homeworks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No assignments yet. Create one above!</p>
          ) : (
            <div className="space-y-4">
              {homeworks.map((hw) => (
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
                        dangerouslySetInnerHTML={{ __html: hw.body }}
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
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
