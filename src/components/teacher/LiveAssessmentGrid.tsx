import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadialSkillMenu } from "./RadialSkillMenu";
import { PointFeedbackAnimation } from "./PointFeedbackAnimation";
import { ReadingTheoryScoreEntry } from "@/components/shared/ReadingTheoryScoreEntry";
import { CheckSquare, Square, Users } from "lucide-react";
import { toast } from "sonner";
import { soundManager } from "@/lib/soundManager";
import { awardPoints, getTodaySession } from "@/lib/pointsHelper";
import { SKILL_ICONS } from "@/lib/skillConfig";
import { LucideIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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

      return enrollments?.map(e => {
        const student = Array.isArray(e.students) ? e.students[0] : e.students;
        return {
          id: student.id,
          full_name: student.full_name,
          avatar_url: student.avatar_url,
          todayPoints: pointsMap.get(student.id) || 0,
          attendanceStatus: attendanceMap.get(student.id) || null,
        };
      }) || [];
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
    setOpenMenuId(null);
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
        {students.map((student) => {
          const isUnavailable = isStudentUnavailable(student.attendanceStatus);
          
          const cardContent = (
            <div
              className={cn(
                "relative flex flex-col items-center p-4 rounded-2xl transition-all touch-manipulation select-none",
                "bg-card border border-border/50",
                isUnavailable 
                  ? "opacity-50 grayscale cursor-not-allowed" 
                  : "cursor-pointer hover:bg-warmGray dark:hover:bg-warmGray-dark active:scale-95",
                bulkMode && selectedStudents.has(student.id) && !isUnavailable && "ring-2 ring-primary bg-primary/10"
              )}
              onClick={(e) => {
                if (isUnavailable) return;
                if (bulkMode) {
                  e.preventDefault();
                  toggleStudent(student.id);
                }
              }}
            >
              {/* Selection Checkbox */}
              {bulkMode && !isUnavailable && (
                <div className="absolute top-2 left-2">
                  <Checkbox
                    checked={selectedStudents.has(student.id)}
                    onCheckedChange={() => toggleStudent(student.id)}
                    className="h-5 w-5"
                  />
                </div>
              )}
              
              {/* Absent/Excused Badge */}
              {isUnavailable && (
                <div className="absolute top-2 right-2">
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    student.attendanceStatus === "Absent" 
                      ? "bg-destructive/20 text-destructive" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {student.attendanceStatus}
                  </span>
                </div>
              )}

              {/* Avatar */}
              <Avatar className="h-16 w-16 mb-2">
                <AvatarImage src={student.avatar_url || undefined} />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {student.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>

              {/* Name */}
              <span className="text-sm font-medium text-center line-clamp-1">
                {student.full_name}
              </span>

              {/* Today's Points */}
              <span className={cn(
                "text-xs font-medium mt-1",
                student.todayPoints > 0 ? "text-green-600 dark:text-green-400" :
                student.todayPoints < 0 ? "text-red-600 dark:text-red-400" :
                "text-muted-foreground"
              )}>
                {student.todayPoints > 0 ? "+" : ""}{student.todayPoints} today
              </span>

              {/* Feedback Animation */}
              <PointFeedbackAnimation
                feedbacks={feedbacks[student.id] || []}
                onComplete={(id) => removeFeedback(student.id, id)}
              />
            </div>
          );
          
          // If student is unavailable, render without popover
          if (isUnavailable) {
            return <div key={student.id}>{cardContent}</div>;
          }
          
          return (
            <Popover 
              key={student.id} 
              open={openMenuId === student.id}
              onOpenChange={(open) => setOpenMenuId(open ? student.id : null)}
            >
              <PopoverTrigger asChild>
                {cardContent}
              </PopoverTrigger>
              
              <PopoverContent 
                className="w-auto p-0 border-0 bg-transparent shadow-none" 
                side="right" 
                align="start"
                sideOffset={12}
                collisionPadding={16}
              >
                <RadialSkillMenu
                  onSkillTap={(skill, points, subTag) => handleSkillTap(student.id, skill, points, subTag)}
                  onClose={() => setOpenMenuId(null)}
                  onReadingTheoryClick={() => setReadingTheoryOpen(true)}
                />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

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
