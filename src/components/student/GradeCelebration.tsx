import { useEffect, useState, useRef } from "react";
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
  const locallySeen = useRef<Set<string>>(new Set());

  const { data: pendingGrades } = useQuery({
    queryKey: ["pending-grade-celebrations", studentId],
    queryFn: async () => {
      try {
        const { data: homeworks, error } = await supabase.rpc("get_student_homeworks", {
          p_student_id: studentId,
        });

        if (error) throw error;

        const hwMap = new Map(
          ((homeworks as any)?.homeworks || []).map((h: any) => [h.id, h])
        );

        const items = ((homeworks as any)?.submissions || [])
          .filter((s: any) => s.status === "graded" && !s.celebration_seen_at && !locallySeen.current.has(s.id))
          .sort((a: any, b: any) => {
            const timeA = a.graded_at ? new Date(a.graded_at).getTime() : 0;
            const timeB = b.graded_at ? new Date(b.graded_at).getTime() : 0;
            return timeB - timeA;
          })
          .slice(0, 5);

        if (items.length === 0) return [];

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
        console.warn("GradeCelebration query failed (RPC):", err);
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
    // Add to local Set immediately to prevent infinite loops if the DB fails
    locallySeen.current.add(submissionId);
    
    // We swallow the error here because the local Set prevents the infinite loop anyway
    await supabase
      .from("homework_submissions")
      .update({ celebration_seen_at: new Date().toISOString() })
      .eq("id", submissionId)
      .catch(() => {});
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
