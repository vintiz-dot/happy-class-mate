import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

interface AddSessionModalProps {
  classId: string;
  date: Date;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddSessionModal = ({ classId, date, open, onClose, onSuccess }: AddSessionModalProps) => {
  const [startTime, setStartTime] = useState("17:30");
  const [endTime, setEndTime] = useState("19:00");
  const [teacherId, setTeacherId] = useState("");
  const [useDefaultTeacher, setUseDefaultTeacher] = useState(true);
  const [rateOverride, setRateOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classData } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("default_teacher_id, session_rate_vnd")
        .eq("id", classId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!classId,
  });

  // Auto-select default teacher when class data loads
  useEffect(() => {
    if (classData?.default_teacher_id && useDefaultTeacher && !teacherId) {
      setTeacherId(classData.default_teacher_id);
    }
  }, [classData, useDefaultTeacher, teacherId]);

  const handleSubmit = async () => {
    if (!teacherId) {
      toast.error("Please select a teacher");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-session", {
        body: {
          action: "create",
          data: {
            class_id: classId,
            date: format(date, "yyyy-MM-dd"),
            start_time: startTime,
            end_time: endTime,
            teacher_id: teacherId,
            rate_override_vnd: rateOverride ? parseInt(rateOverride) : null,
            notes: notes || null,
            status: "Scheduled",
          },
        },
      });

      if (error) throw error;

      toast.success("Session created successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating session:", error);
      toast.error(error.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Session - {format(date, "MMMM d, yyyy")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            <Label htmlFor="teacher">Teacher *</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder={classData?.default_teacher_id ? "Using default teacher" : "Select teacher"} />
              </SelectTrigger>
              <SelectContent>
                {classData?.default_teacher_id && (
                  <SelectItem value={classData.default_teacher_id}>
                    Default Teacher: {teachers.find(t => t.id === classData.default_teacher_id)?.full_name}
                  </SelectItem>
                )}
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {classData?.default_teacher_id && (
              <p className="text-xs text-muted-foreground">
                Default teacher will be used if not specified
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Price Override (VND)</Label>
            <Input
              id="rate"
              type="number"
              placeholder={`Default: ${classData?.session_rate_vnd?.toLocaleString('vi-VN') || '210,000'} ₫`}
              value={rateOverride}
              onChange={(e) => setRateOverride(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (visible to students)</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSessionModal;
