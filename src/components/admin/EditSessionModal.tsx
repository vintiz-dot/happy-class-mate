import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

interface EditSessionModalProps {
  session: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditSessionModal = ({ session, onClose, onSuccess }: EditSessionModalProps) => {
  const [startTime, setStartTime] = useState(session.start_time?.slice(0, 5) || "");
  const [endTime, setEndTime] = useState(session.end_time?.slice(0, 5) || "");
  const [teacherId, setTeacherId] = useState(session.teacher_id || "");
  const [notes, setNotes] = useState(session.notes || "");
  const [processing, setProcessing] = useState(false);

  const { data: teachers } = useQuery({
    queryKey: ["teachers-active-list"],
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

  const isPast = new Date(session.date) < new Date();

  const handleSave = async () => {
    if (!startTime || !endTime) {
      toast.error("Please provide start and end times");
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get old values for audit
      const oldData = {
        start_time: session.start_time,
        end_time: session.end_time,
        teacher_id: session.teacher_id,
        notes: session.notes,
      };

      // Update session
      const { error } = await supabase
        .from("sessions")
        .update({
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          teacher_id: teacherId || session.teacher_id,
          notes: notes || null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", session.id);

      if (error) throw error;

      // Audit log
      await supabase.from("audit_log").insert({
        entity: "sessions",
        action: "update",
        entity_id: session.id,
        actor_user_id: user?.id,
        diff: {
          before: oldData,
          after: {
            start_time: `${startTime}:00`,
            end_time: `${endTime}:00`,
            teacher_id: teacherId || session.teacher_id,
            notes,
          },
          session_date: session.date,
          class_id: session.class_id,
        },
      });

      toast.success("Session updated");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update session");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Session Time</DialogTitle>
          <DialogDescription>
            {session.classes?.name} - {format(new Date(session.date), "MMM dd, yyyy")}
          </DialogDescription>
        </DialogHeader>

        {isPast && session.status === "Held" && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Editing Past Held Session</p>
              <p className="mt-1">
                This session is already held. Time changes will affect payroll and tuition calculations.
              </p>
            </div>
          </div>
        )}

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={processing}>
            {processing ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
