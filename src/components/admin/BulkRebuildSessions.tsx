import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";
import { dayjs } from "@/lib/date";

export function BulkRebuildSessions() {
  const [classId, setClassId] = useState("");
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleRebuild = async () => {
    if (!classId) {
      toast.error("Please select a class");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("schedule-sessions", {
        body: { 
          month,
          mode: "future-only",
          classId, // Filter by specific class
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Rebuild failed");
      }

      setResult(data);
      toast.success(
        `Rebuilt: ${data.created} created, ${data.updated} updated, ${data.removed} removed`
      );
    } catch (error: any) {
      console.error("Error rebuilding:", error);
      toast.error(error.message || "Failed to rebuild sessions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCcw className="h-5 w-5" />
          Bulk Rebuild Sessions
        </CardTitle>
        <CardDescription>
          Rebuild schedule for a specific class and month
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="class">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        </div>

        {result && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="font-medium">Rebuild Results</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Created: {result.created}</Badge>
              <Badge variant="secondary">Updated: {result.updated}</Badge>
              <Badge variant="outline">Removed: {result.removed}</Badge>
              {result.skippedConflicts?.length > 0 && (
                <Badge variant="destructive">
                  Conflicts: {result.skippedConflicts.length}
                </Badge>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleRebuild}
          disabled={loading || !classId}
          className="w-full"
        >
          {loading ? "Rebuilding..." : "Rebuild Sessions"}
        </Button>
      </CardContent>
    </Card>
  );
}
