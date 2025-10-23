import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { JournalList } from "@/components/journal/JournalList";
import { JournalViewer } from "@/components/journal/JournalViewer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content_rich: string;
  type: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  student_id?: string;
  class_id?: string;
  is_deleted: boolean;
}

export function AdminJournalView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");

    if (error) {
      toast({
        title: "Error loading students",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setStudents(data || []);
    }
  };

  const handleSave = () => {
    setIsCreating(false);
    setEditingId(null);
    setRefreshKey((k) => k + 1);
  };

  if (isCreating || editingId) {
    return (
      <JournalEditor
        studentId={selectedStudentId}
        entryId={editingId || undefined}
        onSave={handleSave}
        onCancel={() => {
          setIsCreating(false);
          setEditingId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedStudentId && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        )}
      </div>

      {selectedStudentId && (
        <>
          <JournalList
            key={refreshKey}
            studentId={selectedStudentId}
            onEdit={setEditingId}
            onView={setViewingEntry}
          />
          <JournalViewer entry={viewingEntry} onClose={() => setViewingEntry(null)} />
        </>
      )}
    </div>
  );
}
