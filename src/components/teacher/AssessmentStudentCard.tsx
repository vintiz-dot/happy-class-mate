import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PointFeedbackAnimation } from "./PointFeedbackAnimation";
import type { LucideIcon } from "lucide-react";

type AttendanceStatus = "Present" | "Absent" | "Excused" | null;

export interface FeedbackItem {
  id: string;
  points: number;
  icon: LucideIcon;
  color: string;
  count?: number;
  studentId: string;
}

interface AssessmentStudentCardProps {
  studentId: string;
  fullName: string;
  avatarUrl: string | null;
  todayPoints: number;
  attendanceStatus: AttendanceStatus;
  bulkMode: boolean;
  isSelected: boolean;
  feedbacks: FeedbackItem[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onFeedbackComplete: (studentId: string, feedbackId: string) => void;
}

function isUnavailable(status: AttendanceStatus) {
  return status === "Absent" || status === "Excused";
}

function AssessmentStudentCardImpl({
  studentId,
  fullName,
  avatarUrl,
  todayPoints,
  attendanceStatus,
  bulkMode,
  isSelected,
  feedbacks,
  onSelect,
  onToggle,
  onFeedbackComplete,
}: AssessmentStudentCardProps) {
  const unavailable = isUnavailable(attendanceStatus);

  const card = (
    <div
      className={cn(
        "relative flex flex-col items-center p-4 rounded-2xl transition-all touch-manipulation select-none",
        "bg-card border border-border/50",
        unavailable
          ? "opacity-50 grayscale cursor-not-allowed"
          : "cursor-pointer hover:bg-warmGray dark:hover:bg-warmGray-dark active:scale-95",
        bulkMode && isSelected && !unavailable && "ring-2 ring-primary bg-primary/10"
      )}
      onClick={(e) => {
        if (unavailable) return;
        if (bulkMode) {
          e.preventDefault();
          onToggle(studentId);
        }
      }}
    >
      {bulkMode && !unavailable && (
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle(studentId)}
            className="h-5 w-5"
          />
        </div>
      )}

      {unavailable && (
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              attendanceStatus === "Absent"
                ? "bg-destructive/20 text-destructive"
                : "bg-muted text-muted-foreground"
            )}
          >
            {attendanceStatus}
          </span>
        </div>
      )}

      <Avatar className="h-16 w-16 mb-2">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
          {fullName.charAt(0)}
        </AvatarFallback>
      </Avatar>

      <span className="text-sm font-medium text-center line-clamp-1">{fullName}</span>

      <span
        className={cn(
          "text-xs font-medium mt-1",
          todayPoints > 0
            ? "text-green-600 dark:text-green-400"
            : todayPoints < 0
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
        )}
      >
        {todayPoints > 0 ? "+" : ""}
        {todayPoints} today
      </span>

      <PointFeedbackAnimation
        feedbacks={feedbacks}
        onComplete={(id) => onFeedbackComplete(studentId, id)}
      />
    </div>
  );

  if (unavailable) return <div>{card}</div>;

  return (
    <div
      onClick={() => {
        if (!bulkMode) onSelect(studentId);
      }}
    >
      {card}
    </div>
  );
}

export const AssessmentStudentCard = memo(AssessmentStudentCardImpl, (prev, next) => {
  return (
    prev.studentId === next.studentId &&
    prev.fullName === next.fullName &&
    prev.avatarUrl === next.avatarUrl &&
    prev.todayPoints === next.todayPoints &&
    prev.attendanceStatus === next.attendanceStatus &&
    prev.bulkMode === next.bulkMode &&
    prev.isSelected === next.isSelected &&
    prev.feedbacks === next.feedbacks
  );
});
