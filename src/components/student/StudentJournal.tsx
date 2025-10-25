import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { JournalList } from "@/components/journal/JournalList";
import { JournalViewer } from "@/components/journal/JournalViewer";
import { Plus } from "lucide-react";

interface StudentJournalProps {
  studentId: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content_rich: string;
  type: string;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
}

export function StudentJournal({ studentId }: StudentJournalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSave = () => {
    setIsCreating(false);
    setEditingId(null);
    setRefreshKey((k) => k + 1);
  };

  if (isCreating || editingId) {
    return (
      <JournalEditor
        type={isCreating ? "personal" : undefined}
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Journal</h2>
      </div>
      <JournalList
        key={refreshKey}
        onEdit={setEditingId}
        onView={setViewingEntry}
      />
      <JournalViewer entry={viewingEntry} onClose={() => setViewingEntry(null)} />
    </div>
  );
}
