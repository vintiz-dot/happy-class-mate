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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface DeleteSessionDialogProps {
  session: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteSessionDialog({ session, open, onClose, onSuccess }: DeleteSessionDialogProps) {
  const [hardDelete, setHardDelete] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (hardDelete && !confirmHardDelete) {
      toast.error("Please confirm permanent deletion");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("manage-session", {
        body: {
          action: hardDelete ? "delete" : "cancel",
          data: {
            id: session.id,
            reason: "Deleted via admin interface",
          },
        },
      });

      if (error) throw error;

      toast.success(hardDelete ? "Session permanently deleted" : "Session canceled");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error deleting session:", error);
      toast.error(error.message || "Failed to delete session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Session</AlertDialogTitle>
          <AlertDialogDescription>
            Choose how to remove this session. Canceling keeps the record for audit purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hard-delete"
              checked={hardDelete}
              onCheckedChange={(checked) => {
                setHardDelete(!!checked);
                setConfirmHardDelete(false);
              }}
            />
            <Label htmlFor="hard-delete" className="font-normal">
              Permanently delete (cannot be undone)
            </Label>
          </div>

          {hardDelete && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Irreversible Action</p>
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete the session and all associated attendance records.
                    This action cannot be undone and will be recorded in the audit log.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-hard-delete"
                  checked={confirmHardDelete}
                  onCheckedChange={(checked) => setConfirmHardDelete(!!checked)}
                />
                <Label htmlFor="confirm-hard-delete" className="font-normal text-sm">
                  I understand this action cannot be undone
                </Label>
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Session</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={loading || (hardDelete && !confirmHardDelete)}
            className={hardDelete ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {loading ? "Processing..." : hardDelete ? "Permanently Delete" : "Cancel Session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
