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
}

const DAYS = [
  { value: 0, label: "Chủ Nhật" },
  { value: 1, label: "Thứ Hai" },
  { value: 2, label: "Thứ Ba" },
  { value: 3, label: "Thứ Tư" },
  { value: 4, label: "Thứ Năm" },
  { value: 5, label: "Thứ Sáu" },
  { value: 6, label: "Thứ Bảy" },
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
    setWeeklySlots([...weeklySlots, { dayOfWeek: 1, startTime: "14:00", endTime: "15:30" }]);
  };

  const removeSlot = (index: number) => {
    setWeeklySlots(weeklySlots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof WeeklySlot, value: number | string) => {
    const updated = [...weeklySlots];
    updated[index] = { ...updated[index], [field]: value };
    setWeeklySlots(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !teacherId || weeklySlots.length === 0) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ thông tin và thêm ít nhất một buổi học",
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
        title: "Thành công",
        description: "Đã tạo lớp học mới",
      });

      setName("");
      setTeacherId("");
      setSessionRate(210000);
      setWeeklySlots([]);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Lỗi",
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
        <CardTitle>Tạo lớp học mới</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Tên lớp</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Lớp A1 - Sáng"
            />
          </div>

          <div>
            <Label htmlFor="teacher">Giáo viên</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn giáo viên" />
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
            <Label htmlFor="rate">Học phí mỗi buổi</Label>
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
              <Label>Lịch học hàng tuần</Label>
              <Button type="button" onClick={addSlot} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Thêm buổi học
              </Button>
            </div>

            {weeklySlots.map((slot, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Ngày</Label>
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

                <div className="flex-1">
                  <Label>Bắt đầu</Label>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                  />
                </div>

                <div className="flex-1">
                  <Label>Kết thúc</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                  />
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
            {isSubmitting ? "Đang tạo..." : "Tạo lớp học"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
