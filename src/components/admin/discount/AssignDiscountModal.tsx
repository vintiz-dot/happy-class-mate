import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface AssignDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  onSuccess: () => void;
}

export function AssignDiscountModal({ open, onOpenChange, studentId, onSuccess }: AssignDiscountModalProps) {
  const [discountDefId, setDiscountDefId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data: definitions } = useQuery({
    queryKey: ["discount-definitions-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_definitions")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleAssign = async () => {
    if (!discountDefId) {
      toast({
        title: "Missing field",
        description: "Please select a discount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("discount_assignments").insert({
        student_id: studentId,
        discount_def_id: discountDefId,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        note: memo || null,
      });

      if (error) {
        if (error.message?.includes("no_overlapping_assignments")) {
          throw new Error("This discount already has an overlapping assignment for this student");
        }
        throw error;
      }

      // Audit log
      await supabase.from("audit_log").insert({
        entity: "discount_assignment",
        entity_id: studentId,
        action: "create",
        diff: { discount_def_id: discountDefId, effective_from: effectiveFrom, effective_to: effectiveTo },
      });

      toast({
        title: "Success",
        description: "Discount assigned to student",
      });

      onSuccess();
      onOpenChange(false);
      setDiscountDefId("");
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setEffectiveTo("");
      setMemo("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedDef = definitions?.find((d) => d.id === discountDefId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Special Discount</DialogTitle>
          <DialogDescription>
            Assign a special discount to this student. It will apply starting from the effective date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Discount</Label>
            <Select value={discountDefId} onValueChange={setDiscountDefId}>
              <SelectTrigger>
                <SelectValue placeholder="Select discount" />
              </SelectTrigger>
              <SelectContent>
                {definitions?.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.name} ({def.value}
                    {def.type === "percent" ? "%" : " VND"} - {def.cadence})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDef && (
              <p className="text-sm text-muted-foreground">
                Expected effect: {selectedDef.type === "percent" ? `${selectedDef.value}% off` : `${selectedDef.value.toLocaleString()} VND off`}{" "}
                {selectedDef.cadence === "monthly" ? "every month" : "once"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Effective To (optional)</Label>
              <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Memo (optional)</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note about this assignment" rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading}>
            Assign Discount
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
