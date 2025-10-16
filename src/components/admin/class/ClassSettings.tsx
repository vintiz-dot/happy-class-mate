import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

interface WeeklySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId?: string;
}

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const ClassSettings = ({ classId }: { classId: string }) => {
  const [defaultTeacherId, setDefaultTeacherId] = useState("");
  const [sessionRate, setSessionRate] = useState(0);
  const [defaultStartTime, setDefaultStartTime] = useState("");
  const [defaultSessionLength, setDefaultSessionLength] = useState(90);
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: classData } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
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

  useEffect(() => {
    if (classData) {
      setDefaultTeacherId(classData.default_teacher_id || "");
      setSessionRate(classData.session_rate_vnd || 0);
      setDefaultSessionLength(classData.default_session_length_minutes || 90);
      
      // Parse typical start times if available
      if (classData.typical_start_times && Array.isArray(classData.typical_start_times)) {
        const firstTime = classData.typical_start_times[0];
        setDefaultStartTime(typeof firstTime === 'string' ? firstTime : "");
      }

      // Parse schedule template
      if (classData.schedule_template && typeof classData.schedule_template === 'object') {
        const template = classData.schedule_template as { weeklySlots?: WeeklySlot[] };
        if (template.weeklySlots && Array.isArray(template.weeklySlots)) {
          setWeeklySlots(template.weeklySlots);
        }
      }
    }
  }, [classData]);

  const addSlot = () => {
    setWeeklySlots([...weeklySlots, { dayOfWeek: 1, startTime: "17:30", endTime: "19:00", teacherId: defaultTeacherId }]);
  };

  const removeSlot = (index: number) => {
    setWeeklySlots(weeklySlots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof WeeklySlot, value: number | string | undefined) => {
    const updated = [...weeklySlots];
    updated[index] = { ...updated[index], [field]: value };
    setWeeklySlots(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        default_teacher_id: defaultTeacherId || null,
        session_rate_vnd: sessionRate,
        default_session_length_minutes: defaultSessionLength,
        schedule_template: { weeklySlots },
      };

      if (defaultStartTime) {
        updateData.typical_start_times = [defaultStartTime];
      }

      const { error } = await supabase
        .from("classes")
        .update(updateData)
        .eq("id", classId);

      if (error) throw error;

      // Trigger recalculations for affected students and teachers
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      // Get all enrollments for this class
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId);

      // Recalculate tuition for each student
      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map(e => e.student_id);
        console.log(`Recalculating tuition for ${studentIds.length} students`);
        
        // Trigger tuition recalculation for each student
        for (const studentId of studentIds) {
          await supabase.functions.invoke("calculate-tuition", {
            body: { studentId, month: currentMonth },
          }).catch(err => console.error(`Failed to recalculate tuition for student ${studentId}:`, err));
        }
      }

      // Get teachers for this class and recalculate payroll
      const { data: sessions } = await supabase
        .from("sessions")
        .select("teacher_id")
        .eq("class_id", classId)
        .gte("date", `${currentMonth}-01`)
        .lte("date", `${currentMonth}-31`);

      if (sessions && sessions.length > 0) {
        const teacherIds = [...new Set(sessions.map(s => s.teacher_id))];
        console.log(`Recalculating payroll for ${teacherIds.length} teachers`);
        
        for (const teacherId of teacherIds) {
          await supabase.functions.invoke("calculate-payroll", {
            body: { teacherId, month: currentMonth },
          }).catch(err => console.error(`Failed to recalculate payroll for teacher ${teacherId}:`, err));
        }
      }

      toast.success("Class settings updated and calculations triggered");
    } catch (error: any) {
      console.error("Error updating class:", error);
      toast.error(error.message || "Failed to update class settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Class Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default Teacher</Label>
            <Select value={defaultTeacherId} onValueChange={setDefaultTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select default teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers?.filter(t => t.id).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Session Rate (VND)</Label>
            <Input
              type="number"
              value={sessionRate}
              onChange={(e) => setSessionRate(Number(e.target.value) || 0)}
              placeholder="Enter session rate"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default Session Length (minutes)</Label>
            <Input
              type="number"
              value={defaultSessionLength}
              onChange={(e) => setDefaultSessionLength(Number(e.target.value) || 90)}
              placeholder="90"
            />
          </div>

          <div className="space-y-2">
            <Label>Default Start Time</Label>
            <Input
              type="time"
              value={defaultStartTime}
              onChange={(e) => setDefaultStartTime(e.target.value)}
              placeholder="17:30"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Weekly Schedule</Label>
            <Button type="button" onClick={addSlot} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Slot
            </Button>
          </div>

          {weeklySlots.map((slot, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label>Day</Label>
                <Select
                  value={slot.dayOfWeek.toString()}
                  onValueChange={(v) => updateSlot(idx, "dayOfWeek", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Start</Label>
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateSlot(idx, "startTime", e.target.value)}
                />
              </div>

              <div>
                <Label>End</Label>
                <Input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => updateSlot(idx, "endTime", e.target.value)}
                />
              </div>

              <div>
                <Label>Teacher</Label>
                <Select
                  value={slot.teacherId || "default"}
                  onValueChange={(v) => updateSlot(idx, "teacherId", v === "default" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    {teachers?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSlot(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ClassSettings;