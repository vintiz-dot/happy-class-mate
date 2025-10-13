import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface EditSessionModalProps {
  session: {
    id: string;
    teacher_id?: string;
    rate_override_vnd?: number | null;
    status?: string;
    notes?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

const EditSessionModal = ({ session, onClose, onSaved }: EditSessionModalProps) => {
  const [teacherId, setTeacherId] = useState(session.teacher_id || "");
  const [rate, setRate] = useState(session.rate_override_vnd?.toString() || "");
  const [status, setStatus] = useState(session.status || "Scheduled");
  const [notes, setNotes] = useState(session.notes || "");
  const [saving, setSaving] = useState(false);

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-session", {
        body: {
          action: "update",
          data: {
            id: session.id,
            teacher_id: teacherId || null,
            rate_override_vnd: rate ? parseInt(rate) : null,
            status,
            notes: notes || null,
          },
        },
      });

      if (error) throw error;
      toast.success("Session updated successfully");
      onSaved();
    } catch (error: any) {
      console.error("Error updating session:", error);
      toast.error(error.message || "Failed to update session");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers?.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Held">Held</SelectItem>
                <SelectItem value="Canceled">Canceled</SelectItem>
                <SelectItem value="Holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Price Override (VND)</Label>
            <Input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Leave empty for default"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (visible to students)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditSessionModal;
