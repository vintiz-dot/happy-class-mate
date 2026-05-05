import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadialSkillMenu } from "./RadialSkillMenu";
import { PointFeedbackAnimation } from "./PointFeedbackAnimation";
import { ReadingTheoryScoreEntry } from "@/components/shared/ReadingTheoryScoreEntry";
import { CheckSquare, Square, Users, X } from "lucide-react";
import { toast } from "sonner";
import { soundManager } from "@/lib/soundManager";
import { awardPoints, getTodaySession } from "@/lib/pointsHelper";
import { SKILL_ICONS } from "@/lib/skillConfig";
import { LucideIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssessmentStudentCard } from "./AssessmentStudentCard";
import { motion, AnimatePresence } from "framer-motion";

interface LiveAssessmentGridProps {
  classId: string;
  sessionId: string;
}

type AttendanceStatus = "Present" | "Absent" | "Excused" | null;

interface StudentCard {
  id: string;
  full_name: string;
  avatar_url: string | null;
  todayPoints: number;
  attendanceStatus: AttendanceStatus;
}

interface FeedbackItem {
  id: string;
  points: number;
  icon: LucideIcon;
  color: string;
  count?: number;
  studentId: string;
}

export function LiveAssessmentGrid({ classId, sessionId }: LiveAssessmentGridProps) {
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [activeStudent, setActiveStudent] = useState<StudentCard | null>(null);
  const [readingTheoryOpen, setReadingTheoryOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackItem[]>>({});

  const today = dayjs().format("YYYY-MM-DD");

  // Fetch enrolled students with attendance status
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["live-assessment-students", classId, sessionId, today],
    queryFn: async () => {
      // Get enrolled students
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students!inner(id, full_name, avatar_url)
        `)
        .eq("class_id", classId)
        .or(`end_date.is.null,end_date.gt.${today}`);

      if (enrollError) throw enrollError;

      // Get today's points for each student
      const studentIds = enrollments?.map(e => {
        const student = Array.isArray(e.students) ? e.students[0] : e.students;
        return student?.id;
      }).filter(Boolean) || [];

      // Fetch attendance for this session
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("session_id", sessionId)
        .in("student_id", studentIds);

      const attendanceMap = new Map<string, AttendanceStatus>();
      attendanceData?.forEach(a => {
        attendanceMap.set(a.student_id, a.status as AttendanceStatus);
      });

      const { data: todayPoints } = await supabase
        .from("point_transactions")
        .select("student_id, points")
        .eq("class_id", classId)
        .eq("date", today)
        .in("student_id", studentIds);

      // Calculate today's points per student
      const pointsMap = new Map<string, number>();
      todayPoints?.forEach(pt => {
        pointsMap.set(pt.student_id, (pointsMap.get(pt.student_id) || 0) + pt.points);
      });

      // Deduplicate by student_id
      const seen = new Set<string>();
      return (enrollments || []).reduce((acc: StudentCard[], e) => {
        const student = Array.isArray(e.students) ? e.students[0] : e.students;
        if (student && !seen.has(student.id)) {
          seen.add(student.id);
          acc.push({
            id: student.id,
            full_name: student.full_name,
            avatar_url: student.avatar_url,
            todayPoints: pointsMap.get(student.id) || 0,
            attendanceStatus: attendanceMap.get(student.id) || null,
          });
        }
        return acc;
      }, []);
    },
  });

  // Helper to check if student is absent/excused
  const isStudentUnavailable = (status: AttendanceStatus) => 
    status === "Absent" || status === "Excused";
  
  // Get only available students for bulk operations
  const availableStudents = students.filter(s => !isStudentUnavailable(s.attendanceStatus));

  // Mutation for awarding skills using shared helper
  const awardSkillMutation = useMutation({
    mutationFn: async ({ 
      studentIds, 
      skill, 
      points, 
      subTag 
    }: { 
      studentIds: string[]; 
      skill: string; 
      points: number; 
      subTag?: string;
    }) => {
      // Get active session if exists
      const sessionId = await getTodaySession(classId);
      
      await awardPoints({
        studentIds,
        classId,
        skill,
        points,
        subTag,
        sessionId: sessionId || undefined,
      });

      return { studentIds, skill, points };
    },
    onSuccess: ({ studentIds, skill, points }) => {
      queryClient.invalidateQueries({ queryKey: ["live-assessment-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard", classId] });
      queryClient.invalidateQueries({ queryKey: ["student-points"] });
      
      // Play sound
      if (points > 0) {
        soundManager.play("success");
      } else {
        soundManager.play("error");
      }

      // Show feedback animation for each student
      const icon = SKILL_ICONS[skill] || MessageSquare;
      studentIds.forEach(studentId => {
        const feedbackId = `${studentId}-${Date.now()}`;
        setFeedbacks(prev => ({
          ...prev,
          [studentId]: [
            ...(prev[studentId] || []),
            {
              id: feedbackId,
              points,
              icon,
              color: points > 0 ? "green" : "red",
              count: studentIds.length > 1 ? studentIds.length : undefined,
              studentId,
            },
          ],
        }));
      });

      // Clear selection after bulk action
      if (studentIds.length > 1) {
        setSelectedStudents(new Set());
      }
    },
    onError: (error) => {
      console.error("Failed to award skill:", error);
      toast.error("Failed to award skill");
      soundManager.play("error");
    },
  });

  const handleSkillTap = useCallback((studentId: string, skill: string, points: number, subTag?: string) => {
    const targetIds = bulkMode && selectedStudents.size > 0 
      ? Array.from(selectedStudents)
      : [studentId];

    awardSkillMutation.mutate({ studentIds: targetIds, skill, points, subTag });
    setActiveStudent(null);
  }, [bulkMode, selectedStudents, awardSkillMutation]);

  const toggleStudent = (studentId: string) => {
    // Find the student and check if they're unavailable
    const student = students.find(s => s.id === studentId);
    if (student && isStudentUnavailable(student.attendanceStatus)) return;
    
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedStudents(new Set(availableStudents.map(s => s.id)));
  const selectNone = () => setSelectedStudents(new Set());

  const removeFeedback = useCallback((studentId: string, feedbackId: string) => {
    setFeedbacks(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || []).filter(f => f.id !== feedbackId),
    }));
  }, []);

  const handleSelect = useCallback((id: string) => {
    const s = students.find((x) => x.id === id);
    if (s) setActiveStudent(s);
  }, [students]);

  const handleToggle = useCallback((id: string) => {
    toggleStudent(id);
  }, [students]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading students...</div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No students enrolled in this class</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Selection Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/50">
        <Button
          variant={bulkMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setBulkMode(!bulkMode);
            if (!bulkMode) selectNone();
          }}
          className="gap-2"
        >
          {bulkMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          Bulk Mode
        </Button>
        
        {bulkMode && (
          <>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              Clear
            </Button>
            {selectedStudents.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedStudents.size} selected
              </span>
            )}
          </>
        )}
      </div>

      {/* Student Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {students.map((student) => (
          <AssessmentStudentCard
            key={student.id}
            studentId={student.id}
            fullName={student.full_name}
            avatarUrl={student.avatar_url}
            todayPoints={student.todayPoints}
            attendanceStatus={student.attendanceStatus}
            bulkMode={bulkMode}
            isSelected={selectedStudents.has(student.id)}
            feedbacks={feedbacks[student.id] || []}
            onSelect={handleSelect}
            onToggle={handleToggle}
            onFeedbackComplete={removeFeedback}
          />
        ))}
      </div>

      {/* Smart-positioning skill panel — non-modal, never blocks student cards.
          Auto-anchors to a safe edge of the viewport based on which half the
          active student is in, so the panel never covers a clickable student. */}
      <SmartSkillPanel
        activeStudent={activeStudent}
        onClose={() => setActiveStudent(null)}
        onSkillTap={(skill, points, subTag) =>
          activeStudent && handleSkillTap(activeStudent.id, skill, points, subTag)
        }
        onReadingTheoryClick={() => setReadingTheoryOpen(true)}
        bulkActive={bulkMode && selectedStudents.size > 0}
      />

      {/* Reading Theory Score Entry Dialog */}
      <ReadingTheoryScoreEntry
        classId={classId}
        open={readingTheoryOpen}
        onOpenChange={setReadingTheoryOpen}
      />

      {/* Bulk Action Bar */}
      {bulkMode && selectedStudents.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <RadialSkillMenu
            onSkillTap={(skill, points, subTag) => {
              const targetIds = Array.from(selectedStudents);
              awardSkillMutation.mutate({ studentIds: targetIds, skill, points, subTag });
            }}
            onClose={() => {}}
            onReadingTheoryClick={() => setReadingTheoryOpen(true)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Non-modal floating panel for awarding skills to a single student.
 * Positions itself in the half of the viewport opposite the active student card,
 * so the panel never sits on top of any clickable student. Allows the teacher
 * to tap another student card without dismissing first — activeStudent just
 * switches and the panel re-positions itself.
 */
interface SmartSkillPanelProps {
  activeStudent: StudentCard | null;
  onClose: () => void;
  onSkillTap: (skill: string, points: number, subTag?: string) => void;
  onReadingTheoryClick: () => void;
  bulkActive: boolean;
}

function SmartSkillPanel({
  activeStudent,
  onClose,
  onSkillTap,
  onReadingTheoryClick,
  bulkActive,
}: SmartSkillPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<"bottom" | "top">("bottom");

  // Decide top vs bottom anchor based on which half of the viewport
  // the active student card is in. Also scroll the card into view if it
  // would be obscured by the panel.
  useEffect(() => {
    if (!activeStudent) return;

    const cardEl = document.querySelector<HTMLElement>(
      `[data-student-card="${activeStudent.id}"]`
    );
    if (!cardEl) {
      setAnchor("bottom");
      return;
    }

    const rect = cardEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const cardCenterY = rect.top + rect.height / 2;

    // If the card is in the bottom half, dock the panel at the top.
    const newAnchor: "top" | "bottom" = cardCenterY > vh / 2 ? "top" : "bottom";
    setAnchor(newAnchor);

    // Reserve ~280px for the panel + safe gap; scroll if the card is hidden.
    const PANEL_RESERVE = 300;
    const safeTop = newAnchor === "top" ? PANEL_RESERVE : 16;
    const safeBottom = newAnchor === "bottom" ? PANEL_RESERVE : 16;

    const obscured =
      rect.bottom > vh - safeBottom || rect.top < safeTop;
    if (obscured) {
      cardEl.scrollIntoView({
        behavior: "smooth",
        block: newAnchor === "bottom" ? "start" : "end",
      });
    }
  }, [activeStudent?.id]);

  // Close on Escape — keeps keyboard ergonomics of the previous Dialog.
  useEffect(() => {
    if (!activeStudent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStudent, onClose]);

  return (
    <AnimatePresence>
      {activeStudent && (
        <motion.div
          ref={panelRef}
          key="smart-skill-panel"
          initial={{ opacity: 0, y: anchor === "bottom" ? 24 : -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: anchor === "bottom" ? 24 : -24 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-40 w-[min(560px,calc(100vw-1.5rem))]",
            anchor === "bottom"
              ? bulkActive
                ? "bottom-24"
                : "bottom-4"
              : "top-4"
          )}
          // Stop clicks inside the panel from reaching cards behind, but
          // intentionally do NOT block pointer events outside the panel.
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={activeStudent.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {activeStudent.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{activeStudent.full_name}</p>
                <p
                  className={cn(
                    "text-xs",
                    activeStudent.todayPoints > 0
                      ? "text-green-600"
                      : activeStudent.todayPoints < 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                  )}
                >
                  {activeStudent.todayPoints > 0 ? "+" : ""}
                  {activeStudent.todayPoints} today
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <RadialSkillMenu
              onSkillTap={onSkillTap}
              onClose={onClose}
              onReadingTheoryClick={onReadingTheoryClick}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
