import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Pencil, Trash2, Eye } from "lucide-react";
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

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  student_id?: string;
  class_id?: string;
  is_private?: boolean;
}

interface JournalListProps {
  studentId?: string;
  classId?: string;
  isPrivate?: boolean;
  onEdit?: (entryId: string) => void;
  onView?: (entry: JournalEntry) => void;
}

export function JournalList({ studentId, classId, isPrivate, onEdit, onView }: JournalListProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadEntries();
  }, [studentId, classId, isPrivate]);

  const loadEntries = async () => {
    setLoading(true);
    
    let query = supabase.from("journal_entries").select("*");
    
    if (studentId) {
      query = query.eq("student_id", studentId);
    } else if (classId) {
      query = query.eq("class_id", classId);
    } else if (isPrivate) {
      query = query.eq("is_private", true);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading entries",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({
        title: "Error deleting entry",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Entry deleted",
        description: "Journal entry has been deleted successfully",
      });
      loadEntries();
    }
    setDeleteId(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading journal entries...</div>;
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No journal entries yet. Create your first entry!
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{entry.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(entry.created_at), "PPP")}
                    {entry.updated_at !== entry.created_at && " (edited)"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {onView && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onView(entry)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(entry.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteId(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none line-clamp-3"
                dangerouslySetInnerHTML={{ __html: entry.content }}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this journal entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
