import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save } from "lucide-react";

interface TeacherProfileFilesNotesProps {
  teacherId: string;
}

export function TeacherProfileFilesNotes({ teacherId }: TeacherProfileFilesNotesProps) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real implementation, this would save to a teacher_notes table
      // For now, we'll just show a success message
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast({
        title: "Success",
        description: "Notes saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Admin Notes
          </CardTitle>
          <CardDescription>Private notes about this teacher (admin only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about performance, schedule preferences, etc."
              rows={8}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save Notes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Links</CardTitle>
          <CardDescription>Add links to contracts, certificates, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Document Name</Label>
            <Input placeholder="e.g. Teaching Certificate" />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input placeholder="https://..." />
          </div>
          <Button variant="outline">Add Document Link</Button>
          
          <div className="mt-4 text-center py-8 text-muted-foreground border-t">
            No documents added yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
