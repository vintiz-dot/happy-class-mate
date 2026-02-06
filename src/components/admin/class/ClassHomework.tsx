import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileText, Upload, Trash2, Edit } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ClassHomework = ({ classId }: { classId: string }) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

      if (error) {
        console.error("Error creating homework:", error);
        throw error;
      }

      toast.success("Homework posted successfully");
      setTitle("");
      setBody("");
      setDueDate("");
      // Invalidate all homework queries
      queryClient.invalidateQueries({ queryKey: ["class-homeworks"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
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
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `assignments/${homeworkId}/${timestamp}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("homework")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { error: dbError } = await supabase.from("homework_files").insert({
        homework_id: homeworkId,
        file_name: file.name,
        storage_key: filePath,
        size_bytes: file.size,
      });

      if (dbError) {
        console.error("File record insert error:", dbError);
        throw dbError;
      }

      toast.success("File uploaded successfully");
      // Invalidate all homework queries
      queryClient.invalidateQueries({ queryKey: ["class-homeworks"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      refetch();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploadingFor(null);
    }
  };

  const openFile = async (storageKey: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("homework")
        .createSignedUrl(storageKey, 3600); // 1 hour expiry
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      console.error("Error opening file:", error);
      toast.error(error.message || "Failed to open file");
    }
  };

  const handleEdit = (homework: any) => {
    setEditingId(homework.id);
    setTitle(homework.title);
    setBody(homework.body || "");
    setDueDate(homework.due_date || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setDueDate("");
  };

  const handleUpdate = async () => {
    if (!editingId || !title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from("homeworks")
        .update({
          title: title.trim(),
          body: body.trim() || null,
          due_date: dueDate || null,
        })
        .eq("id", editingId);

      if (error) throw error;

      toast.success("Homework updated successfully");
      handleCancelEdit();
      // Invalidate all homework queries
      queryClient.invalidateQueries({ queryKey: ["class-homeworks"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      refetch();
    } catch (error: any) {
      console.error("Error updating homework:", error);
      toast.error(error.message || "Failed to update homework");
    } finally {
      setCreating(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (homeworkId: string) => {
      const { error } = await supabase
        .from("homeworks")
        .delete()
        .eq("id", homeworkId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Homework deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["class-homeworks", classId] });
      setDeleteId(null);
    },
    onError: (error: any) => {
      console.error("Error deleting homework:", error);
      toast.error(error.message || "Failed to delete homework");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Homework" : "Post Homework"}</CardTitle>
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
            <ReactQuill
              theme="snow"
              value={body}
              onChange={setBody}
              placeholder="Optional instructions or notes..."
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
            <Label>Due Date (Optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex gap-2">
            {editingId ? (
              <>
                <Button onClick={handleUpdate} disabled={creating} className="flex-1">
                  {creating ? "Updating..." : "Update Homework"}
                </Button>
                <Button onClick={handleCancelEdit} variant="outline">
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? "Publishing..." : "Publish Homework"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Posted Homework</h3>
        {homeworks?.map((hw) => (
          <Card key={hw.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{hw.title}</CardTitle>
                  {hw.due_date && (
                    <p className="text-sm text-muted-foreground">
                      Due: {format(new Date(hw.due_date), "MMM dd, yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(hw)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(hw.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hw.body && (
                <div 
                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(hw.body) }}
                />
              )}

              {hw.homework_files && hw.homework_files.length > 0 && (
                <div className="space-y-2">
                  <Label>Attached Files</Label>
                  <div className="space-y-1">
                    {hw.homework_files.map((file: any) => (
                      <button
                        key={file.id}
                        onClick={() => openFile(file.storage_key)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        {file.file_name}
                      </button>
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Homework</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this homework? This action cannot be undone and will also delete all student submissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClassHomework;
