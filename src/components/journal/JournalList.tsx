import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { format } from "date-fns";
import { Pencil, Trash2, Eye, LogOut } from "lucide-react";
import { toast } from "sonner";

type JournalType = "personal" | "student" | "class" | "collab_student_teacher";

interface JournalEntry {
  id: string;
  title: string;
  content_rich: string;
  type: JournalType;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
  student_id?: string;
  class_id?: string;
  is_deleted: boolean;
}

interface JournalListProps {
  type?: JournalType;
  studentId?: string;
  classId?: string;
  onEdit?: (id: string) => void;
  onView?: (entry: JournalEntry) => void;
}

export function JournalList({ type, studentId, classId, onEdit, onView }: JournalListProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOwner, setIsOwner] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadEntries();
  }, [type, studentId, classId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("journals" as any)
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (type) {
        query = query.eq("type", type);
      }
      if (studentId) {
        query = query.eq("student_id", studentId);
      }
      if (classId) {
        query = query.eq("class_id", classId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setEntries((data || []) as any as JournalEntry[]);

      // Check ownership
      const ownershipMap: Record<string, boolean> = {};
      ((data || []) as any as JournalEntry[]).forEach((entry) => {
        ownershipMap[entry.id] = entry.owner_user_id === user.id;
      });
      setIsOwner(ownershipMap);
    } catch (error: any) {
      toast.error("Error loading entries", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("journals" as any)
        .update({ is_deleted: true })
        .eq("id", deleteId);

      if (error) throw error;

      toast.success("Entry deleted");
      loadEntries();
    } catch (error: any) {
      toast.error("Error deleting entry", { description: error.message });
    } finally {
      setDeleteId(null);
    }
  };

  const handleLeave = async (journalId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("journal_members" as any)
        .delete()
        .eq("journal_id", journalId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left journal");
      loadEntries();
    } catch (error: any) {
      toast.error("Error leaving journal", { description: error.message });
    }
  };

  const getTypeBadge = (type: JournalType) => {
    const variants: Record<JournalType, string> = {
      personal: "default",
      student: "secondary",
      class: "outline",
      collab_student_teacher: "destructive",
    };
    return <Badge variant={variants[type] as any}>{type.replace(/_/g, " ")}</Badge>;
  };

  const filteredEntries = entries.filter((entry) =>
    entry.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search journals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No journal entries found.
          </CardContent>
        </Card>
      ) : (
        filteredEntries.map((entry) => {
          const truncatedContent = entry.content_rich.replace(/<[^>]*>/g, "").substring(0, 150);
          
          return (
            <Card key={entry.id} className="mb-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{entry.title}</CardTitle>
                  {getTypeBadge(entry.type)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(entry.created_at), "PPP")}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {truncatedContent}
                  {entry.content_rich.length > 150 && "..."}
                </p>
                <div className="flex gap-2">
                  {onView && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onView(entry)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  )}
                  {onEdit && isOwner[entry.id] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(entry.id)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {isOwner[entry.id] ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLeave(entry.id)}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Leave
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
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
