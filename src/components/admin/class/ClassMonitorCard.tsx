import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Crown, X, UserCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ClassMonitorCardProps {
  classId: string;
}

export function ClassMonitorCard({ classId }: ClassMonitorCardProps) {
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState("");

  // Fetch enrolled students
  const { data: enrolledStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ["class-enrolled-students", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, students:student_id(id, full_name, avatar_url)")
        .eq("class_id", classId)
        .is("end_date", null);
      if (error) throw error;
      return data?.map((e: any) => e.students).filter(Boolean) || [];
    },
  });

  // Fetch current monitor
  const { data: currentMonitor, isLoading: loadingMonitor } = useQuery({
    queryKey: ["class-monitor", classId],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_monitors")
        .select("id, student_id, assigned_at, students:student_id(full_name, avatar_url)")
        .eq("class_id", classId)
        .maybeSingle();
      return data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (currentMonitor) {
        const { error } = await supabase
          .from("class_monitors")
          .update({ student_id: studentId, assigned_at: new Date().toISOString() })
          .eq("class_id", classId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_monitors")
          .insert({ class_id: classId, student_id: studentId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-monitor", classId] });
      toast.success("Class monitor assigned!");
      setSelectedStudent("");
    },
    onError: () => toast.error("Failed to assign monitor"),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("class_monitors")
        .delete()
        .eq("class_id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-monitor", classId] });
      toast.success("Monitor removed");
    },
    onError: () => toast.error("Failed to remove monitor"),
  });

  const monitorName = (currentMonitor as any)?.students?.full_name;
  const isLoading = loadingStudents || loadingMonitor;

  return (
    <Card className="border-warning/20 bg-gradient-to-br from-warning/5 via-card to-card shadow-lg overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-warning/15">
            <Shield className="h-5 w-5 text-warning" />
          </div>
          <div>
            <span className="text-foreground">Class Monitor</span>
            <p className="text-xs font-normal text-muted-foreground mt-0.5">
              Designate a student as class leader
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ) : (
          <>
            {/* Current Monitor Display */}
            <AnimatePresence mode="wait">
              {currentMonitor ? (
                <motion.div
                  key="monitor"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20"
                >
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-warning" />
                    </div>
                    <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      🛡️ {monitorName || "Unknown Student"}
                    </p>
                    <p className="text-xs text-muted-foreground">Current Class Monitor</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 rounded-xl bg-muted/30 border border-dashed border-border text-center"
                >
                  <UserCheck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-1" />
                  <p className="text-xs text-muted-foreground">No monitor assigned yet</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Assignment controls */}
            <div className="flex gap-2">
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Select a student..." />
                </SelectTrigger>
                <SelectContent>
                  {(enrolledStudents || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-9 gap-1 bg-warning hover:bg-warning/90 text-warning-foreground"
                disabled={!selectedStudent || assignMutation.isPending}
                onClick={() => selectedStudent && assignMutation.mutate(selectedStudent)}
              >
                <Shield className="h-3.5 w-3.5" />
                {currentMonitor ? "Reassign" : "Assign"}
              </Button>
            </div>

            {enrolledStudents?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                No students enrolled in this class yet.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
