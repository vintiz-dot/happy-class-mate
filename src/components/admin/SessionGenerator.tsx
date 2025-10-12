import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";

export function SessionGenerator({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sessions", {
        body: { month },
      });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: `Đã tạo ${data.sessionsCreated} buổi học cho tháng ${month}`,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Tạo lịch học tháng
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="month">Chọn tháng</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
          {isGenerating ? "Đang tạo lịch..." : "Tạo lịch học"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Hệ thống sẽ tự động tạo buổi học dựa trên lịch học hàng tuần của các lớp.
          Nếu buổi học đã tồn tại hoặc giáo viên bận, buổi học sẽ được bỏ qua.
        </p>
      </CardContent>
    </Card>
  );
}
