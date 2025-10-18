import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const BulkEnrollmentDateSetter = () => {
  const [targetDate, setTargetDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterClass, setFilterClass] = useState<string>("all");
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ["active-classes"],
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

  const { data: previewData } = useQuery({
    queryKey: ["enrollment-bulk-preview", filterClass, targetDate],
    queryFn: async () => {
      let query = supabase
        .from("enrollments")
        .select(`
          id,
          start_date,
          student_id,
          class_id,
          students(full_name),
          classes(name)
        `)
        .is("end_date", null);

      if (filterClass !== "all") {
        query = query.eq("class_id", filterClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: showPreview,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const enrollmentIds = previewData?.map((e) => e.id) || [];
      
      if (enrollmentIds.length === 0) {
        throw new Error("No enrollments to update");
      }

      const { error } = await supabase
        .from("enrollments")
        .update({ start_date: targetDate })
        .in("id", enrollmentIds);

      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_log").insert({
          entity: "enrollments",
          action: "bulk_update_start_date",
          actor_user_id: user.id,
          diff: {
            count: enrollmentIds.length,
            new_start_date: targetDate,
            class_filter: filterClass,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(`Updated ${previewData?.length || 0} enrollment dates`);
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ["class-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update enrollment dates");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Bulk Set Enrollment Date
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Target Date</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Filter by Class</Label>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger>
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!showPreview ? (
          <Button onClick={() => setShowPreview(true)} className="w-full">
            Preview Changes
          </Button>
        ) : (
          <>
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-semibold">Preview: {previewData?.length || 0} enrollments will be updated</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All selected enrollments will have their start date set to {format(new Date(targetDate), "MMM dd, yyyy")}
                  </p>
                </div>
              </div>
              {previewData && previewData.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 mt-3">
                  {previewData.slice(0, 10).map((e) => (
                    <div key={e.id} className="text-sm flex justify-between">
                      <span>{e.students?.full_name} - {e.classes?.name}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(e.start_date), "yyyy-MM-dd")} → {targetDate}
                      </span>
                    </div>
                  ))}
                  {previewData.length > 10 && (
                    <p className="text-xs text-muted-foreground italic">
                      ...and {previewData.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowPreview(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !previewData?.length}
                className="flex-1"
              >
                {updateMutation.isPending ? "Updating..." : "Confirm Update"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
