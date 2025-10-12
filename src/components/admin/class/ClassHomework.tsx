import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileText, Upload } from "lucide-react";

const ClassHomework = ({ classId }: { classId: string }) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const { data: homeworks, refetch } = useQuery({
    queryKey: ["class-homeworks", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homeworks")
        .select(`
          *,
          homework_files(*)
        `)
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setCreating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("homeworks").insert({
        class_id: classId,
        title: title.trim(),
        body: body.trim() || null,
        due_date: dueDate || null,
        created_by: user.user?.id,
      });

      if (error) throw error;

      toast.success("Homework posted successfully");
      setTitle("");
      setBody("");
      setDueDate("");
      refetch();
    } catch (error: any) {
      console.error("Error creating homework:", error);
      toast.error(error.message || "Failed to post homework");
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (homeworkId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingFor(homeworkId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${homeworkId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("homework")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("homework_files").insert({
        homework_id: homeworkId,
        file_name: file.name,
        storage_key: fileName,
        size_bytes: file.size,
      });

      if (dbError) throw dbError;

      toast.success("File uploaded successfully");
      refetch();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploadingFor(null);
    }
  };

  const getFileUrl = (storageKey: string) => {
    const { data } = supabase.storage.from("homework").getPublicUrl(storageKey);
    return data.publicUrl;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Post Homework</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Grammar Exercise 5"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional instructions or notes..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? "Publishing..." : "Publish Homework"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Posted Homework</h3>
        {homeworks?.map((hw) => (
          <Card key={hw.id}>
            <CardHeader>
              <CardTitle className="text-lg">{hw.title}</CardTitle>
              {hw.due_date && (
                <p className="text-sm text-muted-foreground">
                  Due: {format(new Date(hw.due_date), "MMM dd, yyyy")}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {hw.body && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{hw.body}</p>
              )}

              {hw.homework_files && hw.homework_files.length > 0 && (
                <div className="space-y-2">
                  <Label>Attached Files</Label>
                  <div className="space-y-1">
                    {hw.homework_files.map((file: any) => (
                      <a
                        key={file.id}
                        href={getFileUrl(file.storage_key)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        {file.file_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Add File (Max 5MB)</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(hw.id, file);
                      e.target.value = "";
                    }}
                    disabled={uploadingFor === hw.id}
                  />
                  {uploadingFor === hw.id && (
                    <Button disabled size="sm">
                      <Upload className="h-4 w-4 animate-spin" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!homeworks?.length && (
          <p className="text-muted-foreground text-center py-8">No homework posted yet</p>
        )}
      </div>
    </div>
  );
};

export default ClassHomework;
