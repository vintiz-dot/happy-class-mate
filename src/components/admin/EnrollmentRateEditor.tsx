import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface EnrollmentRateEditorProps {
  studentId: string;
  month: string;
  onClose: () => void;
}

export function EnrollmentRateEditor({ studentId, month, onClose }: EnrollmentRateEditorProps) {
  const [rateOverrides, setRateOverrides] = useState<Map<string, number | null>>(new Map());
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["student-enrollments", studentId, month],
    queryFn: async () => {
      const monthStart = `${month}-01`;
      const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          classes(id, name, session_rate_vnd)
        `)
        .eq("student_id", studentId)
        .lte("start_date", monthEnd)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);

      if (error) throw error;

      // Initialize rate overrides map
      const initialMap = new Map<string, number | null>();
      data?.forEach((enrollment: any) => {
        if (enrollment.rate_override_vnd) {
          initialMap.set(enrollment.id, enrollment.rate_override_vnd);
        }
      });
      setRateOverrides(initialMap);

      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      for (const enrollment of enrollments || []) {
        const override = rateOverrides.get(enrollment.id);
        if (override !== enrollment.rate_override_vnd) {
          const { data, error } = await supabase.functions.invoke("update-enrollment-rate", {
            body: {
              enrollmentId: enrollment.id,
              rateOverrideVnd: override || null,
              reason,
              studentId,
              month,
            },
          });
          if (error) throw error;
          updates.push(data);
        }
      }
      return updates;
    },
    onSuccess: () => {
      toast.success("Enrollment rates updated");
      queryClient.invalidateQueries({ queryKey: ["tuition-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tuition-list"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update rates");
    },
  });

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleRateChange = (enrollmentId: string, value: string) => {
    const newMap = new Map(rateOverrides);
    if (value === "" || value === "0") {
      newMap.delete(enrollmentId);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        newMap.set(enrollmentId, numValue);
      }
    }
    setRateOverrides(newMap);
  };

  const handleClearOverride = (enrollmentId: string) => {
    const newMap = new Map(rateOverrides);
    newMap.delete(enrollmentId);
    setRateOverrides(newMap);
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Session Rates</DialogTitle>
          <DialogDescription>
            Set custom session rates for this student's enrollments. Leave empty to use class default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {enrollments?.map((enrollment: any) => {
            const classData = Array.isArray(enrollment.classes)
              ? enrollment.classes[0]
              : enrollment.classes;
            const defaultRate = classData?.session_rate_vnd || 0;
            const currentOverride = rateOverrides.get(enrollment.id);

            return (
              <div key={enrollment.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{classData?.name || "Unknown Class"}</h4>
                    <p className="text-sm text-muted-foreground">
                      Default rate: {formatVND(defaultRate)}
                    </p>
                  </div>
                  {currentOverride !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearOverride(enrollment.id)}
                    >
                      Clear Override
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`rate-${enrollment.id}`}>Custom Rate (VND)</Label>
                  <Input
                    id={`rate-${enrollment.id}`}
                    type="number"
                    placeholder={defaultRate.toString()}
                    value={currentOverride || ""}
                    onChange={(e) => handleRateChange(enrollment.id, e.target.value)}
                  />
                  {currentOverride && currentOverride !== defaultRate && (
                    <p className="text-xs text-muted-foreground">
                      Difference: {formatVND(currentOverride - defaultRate)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Rate Change (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Special arrangement, scholarship, family discount..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
