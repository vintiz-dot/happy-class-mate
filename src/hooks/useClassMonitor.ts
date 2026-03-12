import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useClassMonitor(classId?: string) {
  return useQuery({
    queryKey: ["class-monitor", classId],
    queryFn: async () => {
      if (!classId) return null;
      const { data } = await supabase
        .from("class_monitors")
        .select("student_id")
        .eq("class_id", classId)
        .maybeSingle();
      return data?.student_id as string | null;
    },
    enabled: !!classId,
  });
}

export function useStudentMonitorClasses(studentId?: string) {
  return useQuery({
    queryKey: ["student-monitor-classes", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data } = await supabase
        .from("class_monitors")
        .select("class_id, classes:class_id(name)")
        .eq("student_id", studentId);
      return (data || []).map((d: any) => ({
        classId: d.class_id,
        className: d.classes?.name || "Unknown",
      }));
    },
    enabled: !!studentId,
  });
}
