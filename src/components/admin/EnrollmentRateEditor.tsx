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
import { Loader2, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface EnrollmentRateEditorProps {
  studentId: string;
  month: string;
  onClose: () => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EnrollmentRateEditor({ studentId, month, onClose }: EnrollmentRateEditorProps) {
  const [rateOverrides, setRateOverrides] = useState<Map<string, number | null>>(new Map());
  const [allowedDaysMap, setAllowedDaysMap] = useState<Map<string, number[] | null>>(new Map());
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
          classes(id, name, session_rate_vnd, schedule_template)
        `)
        .eq("student_id", studentId)
        .lte("start_date", monthEnd)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);

      if (error) throw error;

      // Initialize maps
      const initialRateMap = new Map<string, number | null>();
      const initialDaysMap = new Map<string, number[] | null>();
      data?.forEach((enrollment: any) => {
        if (enrollment.rate_override_vnd) {
          initialRateMap.set(enrollment.id, enrollment.rate_override_vnd);
        }
        initialDaysMap.set(enrollment.id, enrollment.allowed_days);
      });
      setRateOverrides(initialRateMap);
      setAllowedDaysMap(initialDaysMap);

      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      for (const enrollment of enrollments || []) {
        const override = rateOverrides.get(enrollment.id);
        const allowedDays = allowedDaysMap.get(enrollment.id);
        
        const rateChanged = override !== enrollment.rate_override_vnd;
        const daysChanged = JSON.stringify(allowedDays) !== JSON.stringify(enrollment.allowed_days);
        
        if (rateChanged || daysChanged) {
          // Update rate via edge function
          if (rateChanged) {
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
          
          // Update allowed_days directly
          if (daysChanged) {
            const { error } = await supabase
              .from("enrollments")
              .update({ allowed_days: allowedDays || null })
              .eq("id", enrollment.id);
            if (error) throw error;
          }
        }
      }
      
      // Recalculate tuition if days changed
      const anyDaysChanged = enrollments?.some(e => 
        JSON.stringify(allowedDaysMap.get(e.id)) !== JSON.stringify(e.allowed_days)
      );
      if (anyDaysChanged) {
        await supabase.functions.invoke("calculate-tuition", {
          body: { studentId, month }
        });
      }
      
      return updates;
    },
    onSuccess: () => {
      toast.success("Enrollment settings updated");
      queryClient.invalidateQueries({ queryKey: ["tuition-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tuition-list"] });
      queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update settings");
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

  const handleDayToggle = (enrollmentId: string, day: number, classDays: number[]) => {
    const newMap = new Map(allowedDaysMap);
    const current = newMap.get(enrollmentId);
    
    if (current === null || current === undefined) {
      // First toggle: select only this day
      newMap.set(enrollmentId, [day]);
    } else if (current.includes(day)) {
      // Uncheck this day
      const newDays = current.filter(d => d !== day);
      // If all days unchecked, reset to all days (null)
      newMap.set(enrollmentId, newDays.length === 0 ? null : newDays);
    } else {
      // Add this day
      const newDays = [...current, day].sort();
      // If all class days selected, reset to null (all days)
      newMap.set(enrollmentId, newDays.length === classDays.length ? null : newDays);
    }
    
    setAllowedDaysMap(newMap);
  };

  const handleResetDays = (enrollmentId: string) => {
    const newMap = new Map(allowedDaysMap);
    newMap.set(enrollmentId, null);
    setAllowedDaysMap(newMap);
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
          <DialogTitle>Edit Enrollment Settings</DialogTitle>
          <DialogDescription>
            Set custom session rates and attendance days for this student's enrollments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {enrollments?.map((enrollment: any) => {
            const classData = Array.isArray(enrollment.classes)
              ? enrollment.classes[0]
              : enrollment.classes;
            const defaultRate = classData?.session_rate_vnd || 0;
            const currentOverride = rateOverrides.get(enrollment.id);
            const currentAllowedDays = allowedDaysMap.get(enrollment.id);
            
            // Get class schedule days
            const scheduleTemplate = classData?.schedule_template as { weeklySlots?: Array<{ dayOfWeek: number }> } | null;
            const classDays = [...new Set(scheduleTemplate?.weeklySlots?.map(s => s.dayOfWeek) ?? [])].sort();

            return (
              <div key={enrollment.id} className="border rounded-lg p-4 space-y-4">
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
                      Clear Rate
                    </Button>
                  )}
                </div>

                {/* Rate Override */}
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

                {/* Allowed Days */}
                {classDays.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Days Attending
                      </Label>
                      {currentAllowedDays && currentAllowedDays.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetDays(enrollment.id)}
                        >
                          Reset to All
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {classDays.map((day) => {
                        const isChecked = currentAllowedDays === null || 
                          currentAllowedDays === undefined || 
                          currentAllowedDays.includes(day);
                        return (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${enrollment.id}-day-${day}`}
                              checked={isChecked}
                              onCheckedChange={() => handleDayToggle(enrollment.id, day, classDays)}
                            />
                            <label
                              htmlFor={`${enrollment.id}-day-${day}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {DAY_NAMES[day]}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    {currentAllowedDays && currentAllowedDays.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Only {currentAllowedDays.map(d => DAY_NAMES[d]).join(", ")} - won't be billed for other days
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Changes (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Special arrangement, scholarship, partial attendance..."
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