import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { soundManager } from "@/lib/soundManager";

interface GradeCelebrationProps {
  studentId: string;
}

interface GradedItem {
  title: string;
  grade: string;
  className: string;
}

export function GradeCelebration({ studentId }: GradeCelebrationProps) {
  const [celebrationItem, setCelebrationItem] = useState<GradedItem | null>(null);
  const [queue, setQueue] = useState<GradedItem[]>([]);

  const { data: newGrades } = useQuery({
    queryKey: ["new-grades-check", studentId],
    queryFn: async () => {
      const lastSeen = localStorage.getItem(`last-seen-grades-${studentId}`) || "2000-01-01T00:00:00Z";
      
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
        .gt("graded_at", lastSeen)
        .order("graded_at", { ascending: false })
        .limit(5);

      // Update last seen
      localStorage.setItem(`last-seen-grades-${studentId}`, new Date().toISOString());

      return (data || []).map((s: any) => ({
        title: s.homework?.title || "Homework",
        grade: s.grade || "✓",
        className: s.homework?.class?.name || "Class",
      }));
    },
    enabled: !!studentId,
    staleTime: Infinity, // Only run once per mount
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (newGrades?.length) {
      setQueue(newGrades);
      setCelebrationItem(newGrades[0]);
      soundManager.play("success");
    }
  }, [newGrades]);

  const handleComplete = () => {
    const remaining = queue.slice(1);
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
