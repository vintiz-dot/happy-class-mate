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
      const { data, error } = await supabase.functions.invoke("schedule-sessions", {
        body: { month },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.reason || data.error || 'Generation failed');
      }

      const summary = [
        `Created: ${data.created?.length || 0}`,
        `Normalized: ${data.normalized || 0}`,
        data.skippedConflicts?.length ? `Conflicts: ${data.skippedConflicts.length}` : null,
      ].filter(Boolean).join(' • ');

      toast({
        title: "Schedule Generated",
        description: summary,
      });

      if (data.attention?.noTeacherExpected?.length || data.attention?.noTeacherExisting?.length) {
        console.warn('Attention needed:', data.attention);
      }

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
          Idempotent schedule generation. Creates missing sessions from class templates,
          preserves existing assignments, and normalizes invalid future states.
          Running multiple times produces the same result.
        </p>
      </CardContent>
    </Card>
  );
}
