import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRightLeft, Pause, StopCircle } from "lucide-react";
import { format } from "date-fns";

interface ModifyEnrollmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: {
    id: string;
    student_id: string;
    class_id: string;
    start_date: string;
    end_date: string | null;
    students: {
      full_name: string;
    };
    classes: {
      name: string;
    };
  };
}

export function ModifyEnrollmentModal({
  open,
  onOpenChange,
  enrollment,
}: ModifyEnrollmentModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("transfer");
  
  // Transfer state
  const [newClassId, setNewClassId] = useState("");
  const [transferDate, setTransferDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  
  // Pause state
  const [pauseFrom, setPauseFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pauseTo, setPauseTo] = useState("");
  const [pauseMemo, setPauseMemo] = useState("");
  
  // End state
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  

  // Fetch available classes for transfer
  const { data: availableClasses } = useQuery({
    queryKey: ["available-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("is_active", true)
        .neq("id", enrollment.class_id)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });


  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("modify_enrollment_transfer", {
        p_student_id: enrollment.student_id,
        p_old_class_id: enrollment.class_id,
        p_new_class_id: newClassId,
        p_effective_date: transferDate,
      });
      
      if (error) throw error;
      const result = data as any;
      
      // Trigger tuition recalculation for affected months
      await supabase.functions.invoke("calculate-tuition", {
        body: {
          studentId: enrollment.student_id,
          month: result.effective_month,
        },
      });
      
      await supabase.functions.invoke("calculate-tuition", {
        body: {
          studentId: enrollment.student_id,
          month: result.next_month,
        },
      });
      
      return result;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Transferred successfully. ${data.deleted_future_attendance} attendance rows deleted, ${data.seeded_attendance} new rows created.`
      );
      queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["class-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["student-tuition"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to transfer enrollment");
    },
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("pause_enrollment", {
        p_student_id: enrollment.student_id,
        p_class_id: enrollment.class_id,
        p_from_date: pauseFrom,
        p_to_date: pauseTo,
        p_memo: pauseMemo || null,
      });
      
      if (error) throw error;
      const result = data as any;
      
      // Trigger tuition recalculation
      await supabase.functions.invoke("calculate-tuition", {
        body: {
          studentId: enrollment.student_id,
          month: result.effective_month,
        },
      });
      
      return result;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Paused successfully. ${data.excused_attendance} sessions marked as Excused.`
      );
      queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["student-tuition"] });
      queryClient.invalidateQueries({ queryKey: ["pause-windows"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to pause enrollment");
    },
  });

  // End mutation
  const endMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("end_enrollment", {
        p_student_id: enrollment.student_id,
        p_class_id: enrollment.class_id,
        p_end_date: endDate,
      });
      
      if (error) throw error;
      const result = data as any;
      
      // Trigger tuition recalculation
      await supabase.functions.invoke("calculate-tuition", {
        body: {
          studentId: enrollment.student_id,
          month: result.effective_month,
        },
      });
      
      return result;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Ended successfully. ${data.deleted_future_attendance} future attendance rows deleted.`
      );
      queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["student-tuition"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to end enrollment");
    },
  });

  const handleConfirm = () => {
    if (activeTab === "transfer") {
      transferMutation.mutate();
    } else if (activeTab === "pause") {
      pauseMutation.mutate();
    } else {
      endMutation.mutate();
    }
  };

  const isPending = transferMutation.isPending || pauseMutation.isPending || endMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modify Enrollment</DialogTitle>
          <DialogDescription>
            {enrollment.students.full_name} in {enrollment.classes.name}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Past Held sessions are never modified.</strong> Only future attendance and
            financials are adjusted.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transfer">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transfer
            </TabsTrigger>
            <TabsTrigger value="pause">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </TabsTrigger>
            <TabsTrigger value="end">
              <StopCircle className="h-4 w-4 mr-2" />
              End
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="space-y-4">
            <div className="space-y-2">
              <Label>New Class *</Label>
              <Select value={newClassId} onValueChange={setNewClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new class" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Effective Date *</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Old class ends day before. New class starts on this date.
              </p>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={!newClassId || !transferDate || isPending}
              className="w-full"
            >
              {isPending ? "Processing..." : "Confirm Transfer"}
            </Button>
          </TabsContent>

          <TabsContent value="pause" className="space-y-4">
            <div className="space-y-2">
              <Label>Pause From *</Label>
              <Input
                type="date"
                value={pauseFrom}
                onChange={(e) => setPauseFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Pause To *</Label>
              <Input
                type="date"
                value={pauseTo}
                onChange={(e) => setPauseTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Memo (Optional)</Label>
              <Textarea
                value={pauseMemo}
                onChange={(e) => setPauseMemo(e.target.value)}
                placeholder="Reason for pause..."
                rows={3}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Sessions in this window will be marked as Excused. Enrollment dates stay unchanged.
            </p>

            <Button
              onClick={handleConfirm}
              disabled={!pauseFrom || !pauseTo || isPending}
              className="w-full"
            >
              {isPending ? "Processing..." : "Confirm Pause"}
            </Button>
          </TabsContent>

          <TabsContent value="end" className="space-y-4">
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Attendance rows for sessions after this date will be deleted.
              </p>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={!endDate || isPending}
              variant="destructive"
              className="w-full"
            >
              {isPending ? "Processing..." : "Confirm End Enrollment"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
