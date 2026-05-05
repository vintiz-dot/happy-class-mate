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
      const { data } = await supabase
        .from("homework_submissions")
        .select(`
          id,
          grade,
          graded_at,
          homework:homeworks!inner(title, class:classes(name))
        `)
        .eq("student_id", studentId)
        .eq("status", "graded")
        .is("celebration_seen_at", null)
        .order("graded_at", { ascending: false })
        .limit(5);

      return (data || []).map((s: any) => ({
        id: s.id as string,
        title: s.homework?.title || "Homework",
        grade: s.grade || "✓",
        className: s.homework?.class?.name || "Class",
      }));
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
