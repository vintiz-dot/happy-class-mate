import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExamReportsManager } from "@/components/exam-reports/ExamReportsManager";
import { Loader2 } from "lucide-react";

/**
 * Wraps ExamReportsManager for teachers / TAs:
 * automatically restricts class options to those they teach.
 */
export function TeacherExamReportsSection() {
  const { user } = useAuth();

  const { data: staffClassIds, isLoading } = useQuery({
    queryKey: ["teacher-class-ids", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const ids = new Set<string>();

      // Lead teacher classes
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (teacher?.id) {
        const { data: sessions } = await supabase
          .from("sessions")
          .select("class_id")
          .eq("teacher_id", teacher.id);
        sessions?.forEach((s: any) => s.class_id && ids.add(s.class_id));
      }

      // TA classes
      const { data: ta } = await supabase
        .from("teaching_assistants")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (ta?.id) {
        const { data: parts } = await supabase
          .from("session_participants")
          .select("sessions!inner(class_id)")
          .eq("teaching_assistant_id", ta.id)
          .eq("participant_type", "teaching_assistant");
        parts?.forEach((p: any) => p.sessions?.class_id && ids.add(p.sessions.class_id));
      }

      return Array.from(ids);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ExamReportsManager
      staffClassIds={staffClassIds || []}
      isAdmin={false}
      currentUserId={user?.id}
    />
  );
}
