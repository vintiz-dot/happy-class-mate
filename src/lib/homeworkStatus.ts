// Shared homework status logic for consistent colors across all views

export type HomeworkStatus = "overdue" | "due-today" | "due-soon" | "submitted" | "graded" | "upcoming";

export function getHomeworkStatus(assignment: any): HomeworkStatus {
  const submission = assignment.submission;
  if (submission?.status === "graded") return "graded";
  if (submission?.status === "submitted") return "submitted";

  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  if (!dueDate) return "upcoming";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due-today";
  if (diffDays <= 2) return "due-soon";
  return "upcoming";
}

export const statusConfig: Record<HomeworkStatus, {
  cardClass: string;
  borderColor: string;
  icon: string;
  label: string;
  badgeClass: string;
  textClass: string;
}> = {
  overdue: {
    cardClass: "bg-red-500/20 dark:bg-red-500/15 border-l-4 border-l-red-500",
    borderColor: "border-red-500/40",
    icon: "🔴",
    label: "Overdue",
    badgeClass: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40",
    textClass: "text-red-700 dark:text-red-400",
  },
  "due-today": {
    cardClass: "bg-amber-500/20 dark:bg-amber-500/15 border-l-4 border-l-amber-500",
    borderColor: "border-amber-500/40",
    icon: "🟡",
    label: "Due Today",
    badgeClass: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  "due-soon": {
    cardClass: "bg-amber-400/10 dark:bg-amber-400/10 border-l-4 border-l-amber-400",
    borderColor: "border-amber-400/30",
    icon: "⏰",
    label: "Due Soon",
    badgeClass: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  submitted: {
    cardClass: "bg-sky-500/15 dark:bg-sky-500/10 border-l-4 border-l-sky-400",
    borderColor: "border-sky-400/30",
    icon: "🔵",
    label: "Submitted",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-400/30",
    textClass: "text-sky-700 dark:text-sky-400",
  },
  graded: {
    cardClass: "bg-emerald-500/15 dark:bg-emerald-500/10 border-l-4 border-l-emerald-500",
    borderColor: "border-emerald-500/30",
    icon: "✅",
    label: "Graded",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  upcoming: {
    cardClass: "glass-sm border-l-4 border-l-muted-foreground/20",
    borderColor: "border-border",
    icon: "📝",
    label: "To Do",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-muted-foreground",
  },
};

export function getCountdown(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainHours = diffHours % 24;

  if (diffMs < 0) {
    if (diffDays > 0) return `${diffDays}d ${remainHours}h overdue`;
    return `${diffHours}h overdue`;
  }
  if (diffDays > 7) return null;
  if (diffDays > 0) return `${diffDays}d ${remainHours}h left`;
  if (diffHours > 0) return `${diffHours}h left`;
  return "Due now";
}
