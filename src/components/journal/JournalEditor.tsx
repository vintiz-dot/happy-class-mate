import { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface JournalEditorProps {
  studentId: string;
  entryId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function JournalEditor({ studentId, entryId, onSave, onCancel }: JournalEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  };

  useEffect(() => {
    if (entryId) {
      loadEntry();
    }
  }, [entryId]);

  const loadEntry = async () => {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", entryId)
      .single();

    if (error) {
      toast({
        title: "Error loading entry",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setTitle(data.title);
      setContent(data.content);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both title and content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (entryId) {
        // Update existing entry
        const { error } = await supabase
          .from("journal_entries")
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq("id", entryId);

        if (error) throw error;

        toast({
          title: "Entry updated",
          description: "Your journal entry has been updated successfully",
        });
      } else {
        // Create new entry
        const { error } = await supabase.from("journal_entries").insert({
          student_id: studentId,
          title,
          content,
        });

        if (error) throw error;

        toast({
          title: "Entry saved",
          description: "Your journal entry has been saved successfully",
        });
      }

      setTitle("");
      setContent("");
      onSave?.();
    } catch (error: any) {
      toast({
        title: "Error saving entry",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entryId ? "Edit" : "New"} Journal Entry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Entry title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="min-h-[300px]">
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            className="h-[250px]"
          />
        </div>
        <div className="flex gap-2 pt-12">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Entry"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
