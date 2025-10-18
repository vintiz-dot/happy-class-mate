import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import { format } from "date-fns";

interface Class {
  id: string;
  name: string;
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
  const { toast } = useToast();

  useEffect(() => {
    loadTeacherClasses();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Assignment
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
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Assignment instructions and details"
              rows={4}
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

          <Button type="submit" disabled={uploading} className="w-full">
            {uploading ? "Uploading..." : "Upload Assignment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
