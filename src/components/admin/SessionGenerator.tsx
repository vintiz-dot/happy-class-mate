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
        title: "Success",
        description: `Created ${data.sessionsCreated} sessions for month ${month}`,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
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
          Generate Monthly Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="month">Select Month</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
          {isGenerating ? "Generating schedule..." : "Generate Schedule"}
        </Button>
        <p className="text-sm text-muted-foreground">
          The system will automatically create sessions based on weekly class schedules.
          If a session already exists or the teacher is busy, it will be skipped.
        </p>
      </CardContent>
    </Card>
  );
}
