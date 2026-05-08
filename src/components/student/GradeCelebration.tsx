import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { soundManager } from "@/lib/soundManager";

interface GradeCelebrationProps {
  studentId: string;
}

interface GradedItem {
  id: string;
  title: string;
  grade: string;
  className: string;
}

export function GradeCelebration({ studentId }: GradeCelebrationProps) {
  const [celebrationItem, setCelebrationItem] = useState<GradedItem | null>(null);
  const [queue, setQueue] = useState<GradedItem[]>([]);
  const queryClient = useQueryClient();

  const { data: pendingGrades } = useQuery({
    queryKey: ["pending-grade-celebrations", studentId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("homework_submissions")
          .select(`
            id,
            grade,
            graded_at,
            homework_id
          `)
          .eq("student_id", studentId)
          .eq("status", "graded")
          .is("celebration_seen_at", null)
          .order("graded_at", { ascending: false })
          .limit(5);

        if (error) throw error;

        // Fetch homework titles separately to avoid the inner join RLS issue
        const items = data || [];
        if (items.length === 0) return [];

        const hwIds = items.map((s: any) => s.homework_id);
        const { data: homeworks } = await supabase.rpc("get_student_homeworks", {
          p_student_id: studentId,
        });

        const hwMap = new Map(
          ((homeworks as any)?.homeworks || []).map((h: any) => [h.id, h])
        );

        return items.map((s: any) => {
          const hw = hwMap.get(s.homework_id);
          return {
            id: s.id as string,
            title: hw?.title || "Homework",
            grade: s.grade || "✓",
            className: hw?.classes?.name || "Class",
          };
        });
      } catch (err) {
        console.warn("GradeCelebration query failed (RLS):", err);
        return [];
      }
    },
    enabled: !!studentId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (pendingGrades?.length && !celebrationItem && queue.length === 0) {
      const limited = pendingGrades.slice(0, 2);
      setQueue(limited);
      setCelebrationItem(limited[0]);
      soundManager.play("success");
    }
  }, [pendingGrades, celebrationItem, queue.length]);

  const markSeen = async (submissionId: string) => {
    await supabase
      .from("homework_submissions")
      .update({ celebration_seen_at: new Date().toISOString() })
      .eq("id", submissionId);
  };

  const handleComplete = async () => {
    const current = celebrationItem;
    const remaining = queue.slice(1);

    if (current) {
      // Fire-and-forget — UI advances immediately, DB catches up.
      markSeen(current.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["pending-grade-celebrations", studentId] });
      });
    }

    setQueue(remaining);
    if (remaining.length > 0) {
      setTimeout(() => {
        setCelebrationItem(remaining[0]);
        soundManager.play("success");
      }, 300);
    } else {
      setCelebrationItem(null);
    }
  };

  if (!celebrationItem) return null;

  return (
    <CelebrationOverlay
      show={!!celebrationItem}
      type="achievement"
      title={`Grade: ${celebrationItem.grade}`}
      subtitle={`"${celebrationItem.title}" – ${celebrationItem.className}`}
      onComplete={handleComplete}
    />
  );
}
