import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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

const SESSION_RATES = [
  { value: 210000, label: "210,000 VND" },
  { value: 260000, label: "260,000 VND" },
];

export function ClassForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sessionRate, setSessionRate] = useState(210000);
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const addSlot = () => {
    setWeeklySlots([...weeklySlots, { dayOfWeek: 1, startTime: "14:00", endTime: "15:30", teacherId: teacherId }]);
  };

  const removeSlot = (index: number) => {
    setWeeklySlots(weeklySlots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof WeeklySlot, value: number | string | undefined) => {
    const updated = [...weeklySlots];
    updated[index] = { ...updated[index], [field]: value };
    setWeeklySlots(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !teacherId || weeklySlots.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all information and add at least one session",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("classes").insert([{
        name,
        default_teacher_id: teacherId,
        session_rate_vnd: sessionRate,
        schedule_template: { weeklySlots } as any,
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "New class created",
      });

      setName("");
      setTeacherId("");
      setSessionRate(210000);
      setWeeklySlots([]);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Class</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Class Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g: Class A1 - Morning"
            />
          </div>

          <div>
            <Label htmlFor="teacher">Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Teacher" />
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

          <div>
            <Label htmlFor="rate">Session Fee</Label>
            <Select value={sessionRate.toString()} onValueChange={(v) => setSessionRate(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_RATES.map((rate) => (
                  <SelectItem key={rate.value} value={rate.value.toString()}>
                    {rate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Weekly Schedule</Label>
              <Button type="button" onClick={addSlot} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Session
              </Button>
            </div>

            {weeklySlots.map((slot, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 items-end">
                <div>
                  <Label>Day</Label>
                  <Select
                    value={slot.dayOfWeek.toString()}
                    onValueChange={(v) => updateSlot(index, "dayOfWeek", Number(v))}
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
                    onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                  />
                </div>

                <div>
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Teacher</Label>
                  <Select
                    value={slot.teacherId || "default"}
                    onValueChange={(v) => updateSlot(index, "teacherId", v === "default" ? undefined : v)}
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
                  onClick={() => removeSlot(index)}
                  size="icon"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating..." : "Create Class"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
