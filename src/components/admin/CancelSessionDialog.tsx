import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CancelSessionDialogProps {
  session: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelSessionDialog({ session, open, onClose, onSuccess }: CancelSessionDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("manage-session", {
        body: {
          action: "cancel",
          data: {
            id: session.id,
            reason: reason || "No reason provided",
          },
        },
      });

      if (error) throw error;

      toast.success("Session canceled successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error canceling session:", error);
      toast.error(error.message || "Failed to cancel session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Session</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the session as canceled. It will remain in the database for record-keeping.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="cancel-reason">Cancellation Reason (Optional)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="e.g., Teacher unavailable, holiday, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Session</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} disabled={loading}>
            {loading ? "Canceling..." : "Cancel Session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
