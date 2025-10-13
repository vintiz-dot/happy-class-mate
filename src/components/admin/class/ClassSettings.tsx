import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ClassSettings = ({ classId }: { classId: string }) => {
  const [defaultTeacherId, setDefaultTeacherId] = useState("");
  const [sessionRate, setSessionRate] = useState(0);
  const [defaultStartTime, setDefaultStartTime] = useState("");
  const [defaultEndTime, setDefaultEndTime] = useState("");
  const [defaultSessionLength, setDefaultSessionLength] = useState(90);
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
    }
  }, [classData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        default_teacher_id: defaultTeacherId || null,
        session_rate_vnd: sessionRate,
        default_session_length_minutes: defaultSessionLength,
      };

      if (defaultStartTime) {
        updateData.typical_start_times = [defaultStartTime];
      }

      const { error } = await supabase
        .from("classes")
        .update(updateData)
        .eq("id", classId);

      if (error) throw error;

      toast.success("Class settings updated successfully");
    } catch (error: any) {
      console.error("Error updating class:", error);
      toast.error(error.message || "Failed to update class settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Class Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Default Teacher</Label>
          <Select value={defaultTeacherId} onValueChange={setDefaultTeacherId}>
            <SelectTrigger>
              <SelectValue placeholder="Select default teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers?.map((teacher) => (
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

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ClassSettings;
