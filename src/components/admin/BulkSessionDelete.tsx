import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";

export function BulkSessionDelete() {
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [hardDelete, setHardDelete] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);

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

  const handlePreview = async () => {
    try {
      let query = supabase.from("sessions").select("id, date, start_time, status", { count: "exact" });

      if (classId) query = query.eq("class_id", classId);
      if (teacherId) query = query.eq("teacher_id", teacherId);
      if (fromDate) query = query.gte("date", fromDate);
      if (toDate) query = query.lte("date", toDate);

      const { data, error, count } = await query;
      if (error) throw error;

      const today = new Date().toISOString().split("T")[0];
      const statusCounts = data?.reduce((acc: any, s) => {
        // Skip past Held sessions
        if (s.status === "Held" && s.date < today) {
          acc.skipped = (acc.skipped || 0) + 1;
        } else {
          acc[s.status] = (acc[s.status] || 0) + 1;
        }
        return acc;
      }, {});

      setPreview({ total: count, statusCounts });
    } catch (error: any) {
      toast.error(error.message || "Failed to preview");
    }
  };

  const handleDelete = async () => {
    if (hardDelete && !confirmHardDelete) {
      toast.error("Please confirm permanent deletion");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-session", {
        body: {
          action: "bulk-delete",
          data: {
            class_id: classId || null,
            teacher_id: teacherId || null,
            from_date: fromDate || null,
            to_date: toDate || null,
            hard_delete: hardDelete,
          },
        },
      });

      if (error) throw error;

      toast.success(
        `Successfully ${hardDelete ? "deleted" : "canceled"} ${data.deleted || data.canceled} sessions${
          data.skipped ? ` (${data.skipped} past Held sessions skipped)` : ""
        }`
      );

      // Reset form
      setClassId("");
      setTeacherId("");
      setFromDate("");
      setToDate("");
      setHardDelete(false);
      setConfirmHardDelete(false);
      setPreview(null);
    } catch (error: any) {
      console.error("Error bulk deleting:", error);
      toast.error(error.message || "Failed to delete sessions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Bulk Session Delete
        </CardTitle>
        <CardDescription>
          Cancel or permanently delete multiple sessions by date range and filters. Past Held sessions are never modified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="class">Class (Optional)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="All classes" />
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
            <Label htmlFor="teacher">Teacher (Optional)</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="All teachers" />
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
            <Label htmlFor="from-date">From Date</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to-date">To Date</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="bulk-hard-delete"
              checked={hardDelete}
              onCheckedChange={(checked) => {
                setHardDelete(!!checked);
                setConfirmHardDelete(false);
              }}
            />
            <Label htmlFor="bulk-hard-delete" className="font-normal">
              Permanently delete (cannot be undone)
            </Label>
          </div>

          {hardDelete && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Irreversible Action</p>
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete all matching sessions and their attendance records.
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-bulk-hard-delete"
                  checked={confirmHardDelete}
                  onCheckedChange={(checked) => setConfirmHardDelete(!!checked)}
                />
                <Label htmlFor="confirm-bulk-hard-delete" className="font-normal text-sm">
                  I understand this action cannot be undone
                </Label>
              </div>
            </div>
          )}
        </div>

        {preview && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="font-medium">Preview: {preview.total} sessions match your criteria</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.statusCounts).map(([status, count]: [string, any]) => (
                <Badge key={status} variant="outline">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handlePreview} variant="outline" className="flex-1">
            Preview
          </Button>
          <Button
            onClick={handleDelete}
            disabled={loading || (hardDelete && !confirmHardDelete) || !preview}
            className={hardDelete ? "bg-destructive hover:bg-destructive/90 flex-1" : "flex-1"}
          >
            {loading ? "Processing..." : hardDelete ? "Permanently Delete" : "Cancel Sessions"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Note: Past Held sessions are never modified and will be skipped automatically.
        </p>
      </CardContent>
    </Card>
  );
}
