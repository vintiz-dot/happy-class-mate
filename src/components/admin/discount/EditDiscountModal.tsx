import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: {
    id: string;
    effective_from: string;
    effective_to: string | null;
    note: string | null;
    discount_definitions: {
      name: string;
    };
  };
  studentId: string;
}

export function EditDiscountModal({
  open,
  onOpenChange,
  assignment,
  studentId,
}: EditDiscountModalProps) {
  const queryClient = useQueryClient();
  const [effectiveFrom, setEffectiveFrom] = useState(assignment.effective_from);
  const [effectiveTo, setEffectiveTo] = useState(assignment.effective_to || "");
  const [note, setNote] = useState(assignment.note || "");

  useEffect(() => {
    if (open) {
      setEffectiveFrom(assignment.effective_from);
      setEffectiveTo(assignment.effective_to || "");
      setNote(assignment.note || "");
    }
  }, [open, assignment]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("discount_assignments")
        .update({
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
          note: note || null,
          updated_by: user?.id,
        })
        .eq("id", assignment.id);

      if (error) throw error;

      // Audit log
      await supabase.from("audit_log").insert({
        actor_user_id: user?.id,
        action: "update",
        entity: "discount_assignment",
        entity_id: assignment.id,
        diff: {
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
          note: note || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-assignments", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-tuition"] });
      toast.success("Discount updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating discount:", error);
      toast.error("Failed to update discount");
    },
  });

  const handleUpdate = () => {
    if (!effectiveFrom) {
      toast.error("Please select an effective from date");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Discount</DialogTitle>
          <DialogDescription>
            Modify the dates and notes for {assignment.discount_definitions.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="effectiveFrom">Effective From</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="effectiveTo">Effective To (Optional)</Label>
            <Input
              id="effectiveTo"
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any notes about this discount..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Updating..." : "Update Discount"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
