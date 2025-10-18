import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Ban, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { EditSessionModal } from "./EditSessionModal";

interface SessionActionsModalProps {
  session: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const SessionActionsModal = ({ session, onClose, onSuccess }: SessionActionsModalProps) => {
  const [action, setAction] = useState<"cancel" | "delete" | "edit" | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const TIMEZONE = "Asia/Bangkok";
  const now = toZonedTime(new Date(), TIMEZONE);
  const sessionDate = new Date(session.date);
  const isFuture = sessionDate > now;
  const isScheduled = session.status === "Scheduled";
  const isCanceled = session.status === "Canceled";
  // Admin can delete Scheduled or Canceled sessions (past, present, future)
  const canDelete = isScheduled || isCanceled;

  if (action === "edit") {
    return (
      <EditSessionModal
        session={session}
        onClose={() => setAction(null)}
        onSuccess={onSuccess}
      />
    );
  }

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.functions.invoke("manage-session", {
        body: {
          action: "cancel",
          sessionId: session.id,
          reason: reason || "Admin canceled",
          userId: user?.id,
        },
      });

      if (error) throw error;

      toast.success("Session canceled");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel session");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Hard delete
      const { error: deleteError } = await supabase
        .from("sessions")
        .delete()
        .eq("id", session.id);

      if (deleteError) throw deleteError;

      // Audit
      await supabase.from("audit_log").insert({
        entity: "sessions",
        action: "delete",
        entity_id: session.id,
        actor_user_id: user?.id,
        diff: {
          session_date: session.date,
          class_id: session.class_id,
          teacher_id: session.teacher_id,
          reason: reason || "Admin deleted",
        },
      });

      toast.success("Session deleted");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete session");
    } finally {
      setProcessing(false);
    }
  };

  if (!action) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Actions</DialogTitle>
            <DialogDescription>
              {session.classes?.name} - {format(new Date(session.date), "MMM dd, yyyy")} at{" "}
              {session.start_time?.slice(0, 5)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAction("edit")}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Session Time
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAction("cancel")}
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancel Session
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAction("delete")}
              disabled={!canDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Session
              {!canDelete && (
                <span className="ml-auto text-xs text-muted-foreground">
                  (Scheduled/Canceled only)
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "cancel" ? "Cancel Session" : "Delete Session"}
          </DialogTitle>
          <DialogDescription>
            {session.classes?.name} - {format(new Date(session.date), "MMM dd, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm">
              {action === "cancel" ? (
                <>
                  <p className="font-semibold">This will cancel the session</p>
                  <p className="text-muted-foreground mt-1">
                    The session will remain in the calendar but marked as Canceled. Attendance records will be preserved.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone</p>
                  <p className="text-muted-foreground mt-1">
                    The session will be permanently deleted. Attendance records will be removed.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === "cancel" ? "Why is this session being canceled?" : "Why is this session being deleted?"}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant={action === "delete" ? "destructive" : "default"}
              className="flex-1"
              onClick={action === "cancel" ? handleCancel : handleDelete}
              disabled={processing}
            >
              {processing ? "Processing..." : action === "cancel" ? "Cancel Session" : "Delete Session"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
