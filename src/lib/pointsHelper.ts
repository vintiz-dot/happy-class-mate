import { supabase } from "@/integrations/supabase/client";
import { monthKey } from "@/lib/date";
import { shouldTrackInSkillAssessments, formatSkillLabel } from "@/lib/skillConfig";

export interface AwardPointsParams {
  studentIds: string[];
  classId: string;
  skill: string;
  points: number;
  subTag?: string;
  homeworkId?: string;
  homeworkTitle?: string;
  homeworkDueDate?: string;
  notes?: string;
  sessionId?: string;
}

export interface AwardPointsResult {
  success: boolean;
  studentIds: string[];
  skill: string;
  points: number;
}

/**
 * Award points to one or more students.
 * Handles dual-insert: skill_assessments (for skills) + point_transactions (always).
 */
export async function awardPoints(params: AwardPointsParams): Promise<AwardPointsResult> {
  const { studentIds, classId, skill, points, subTag, homeworkId, homeworkTitle, homeworkDueDate, notes, sessionId } = params;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = monthKey();
  
  // For homework, use the due date for month attribution if provided
  const isHomework = skill === "homework";
  const effectiveDate = (isHomework && homeworkDueDate) ? homeworkDueDate : today;
  const effectiveMonth = effectiveDate.slice(0, 7);
  
  // Determine transaction type
  const shouldTrackSkill = shouldTrackInSkillAssessments(skill);
  const isCorrection = skill === "correction";
  const isAdjustment = skill === "adjustment";
  
  // Get type for point_transactions
  let transactionType: string;
  if (isHomework) {
    transactionType = "homework";
  } else if (isCorrection) {
    transactionType = "correction";
  } else if (isAdjustment) {
    transactionType = "adjustment";
  } else {
    transactionType = "participation";
  }

  // Build notes/description
  const displayNotes = notes || formatSkillLabel(skill, subTag);

  // Prepare skill_assessments records (for skills AND behaviors like focus/teamwork)
  const skillAssessments = shouldTrackSkill ? studentIds.map(studentId => ({
    student_id: studentId,
    class_id: classId,
    session_id: sessionId || null,
    skill: skill,
    score: points,
    date: today,
    created_by: user.id,
    teacher_comment: subTag || null,
  })) : [];

  // Prepare point_transactions records (always)
  // Use effectiveDate/Month for homework, today/currentMonth for others
  const pointTransactions = studentIds.map(studentId => ({
    student_id: studentId,
    class_id: classId,
    session_id: sessionId || null,
    type: transactionType,
    points: points,
    date: effectiveDate,
    month: effectiveMonth,
    notes: displayNotes,
    created_by: user.id,
    homework_id: isHomework && homeworkId ? homeworkId : null,
    homework_title: isHomework && homeworkTitle ? homeworkTitle : null,
  }));

  // Insert skill assessments if applicable
  if (skillAssessments.length > 0) {
    const { error: skillError } = await supabase
      .from("skill_assessments")
      .insert(skillAssessments);
    if (skillError) throw skillError;
  }

  // Insert point transactions
  const { error: pointError } = await supabase
    .from("point_transactions")
    .insert(pointTransactions);
  if (pointError) throw pointError;

  return { success: true, studentIds, skill, points };
}

/**
 * Get the active session for a class today (if any)
 */
export async function getTodaySession(classId: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("sessions")
    .select("id")
    .eq("class_id", classId)
    .eq("date", today)
    .eq("status", "Scheduled")
    .maybeSingle();
  
  return data?.id || null;
}
