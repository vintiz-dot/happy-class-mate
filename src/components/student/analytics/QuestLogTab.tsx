import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday } from "date-fns";
import { CheckCircle, Clock, AlertTriangle, BookOpen, Calendar, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuestLogTabProps {
  studentId: string;
  classId: string;
}

type MissionStatus = "completed" | "pending" | "missing" | "active";

function getMissionStatus(
  submission: { status: string; graded_at: string | null } | null,
  dueDate: string | null
): MissionStatus {
  if (!submission) {
    // No submission
    if (!dueDate) return "active";
    return isPast(new Date(dueDate)) ? "missing" : "active";
  }

  if (submission.graded_at) {
    return "completed";
  }

  return "pending";
}

function getStatusBadge(status: MissionStatus) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Pending Grading
        </Badge>
      );
    case "missing":
      return (
        <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Missing
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
          <Target className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
  }
}

export function QuestLogTab({ studentId, classId }: QuestLogTabProps) {
  // Fetch homework assignments with submission status
  const { data: missions } = useQuery({
    queryKey: ["student-quests", studentId, classId],
    queryFn: async () => {
      // Get all homework for this class
      const { data: homeworks, error: hwError } = await supabase
        .from("homeworks")
        .select("id, title, body, due_date, created_at")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      if (hwError) throw hwError;

      // Get submissions for this student
      const { data: submissions, error: subError } = await supabase
        .from("homework_submissions")
        .select("homework_id, status, grade, graded_at, submitted_at")
        .eq("student_id", studentId);

      if (subError) throw subError;

      // Map submissions by homework_id
      const submissionMap = new Map(
        submissions?.map((s) => [s.homework_id, s]) ?? []
      );

      return (
        homeworks?.map((hw) => ({
          ...hw,
          submission: submissionMap.get(hw.id) ?? null,
        })) ?? []
      );
    },
  });

  // Fetch attendance summary
  const { data: attendance } = useQuery({
    queryKey: ["student-attendance-summary", studentId, classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          status,
          sessions!inner(class_id)
        `)
        .eq("student_id", studentId)
        .eq("sessions.class_id", classId);

      if (error) throw error;

      const summary = { present: 0, absent: 0, excused: 0, total: 0 };
      data?.forEach((entry) => {
        summary.total++;
        const status = entry.status?.toLowerCase();
        if (status === "present") summary.present++;
        else if (status === "absent") summary.absent++;
        else if (status === "excused") summary.excused++;
      });

      return summary;
    },
  });

  // Calculate quest completion stats
  const completed = missions?.filter((m) => getMissionStatus(m.submission, m.due_date) === "completed").length ?? 0;
  const total = missions?.length ?? 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Quest Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mission Completion */}
        <div className="glass-panel p-4 rounded-xl border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Mission Progress</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-bold text-foreground">{completed} / {total}</span>
            </div>
            <Progress value={completionRate} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">{completionRate}% completion rate</p>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="glass-panel p-4 rounded-xl border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Attendance Record</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-black text-green-500">{attendance?.present ?? 0}</div>
              <div className="text-xs text-muted-foreground">Present</div>
            </div>
            <div>
              <div className="text-2xl font-black text-red-500">{attendance?.absent ?? 0}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
            <div>
              <div className="text-2xl font-black text-yellow-500">{attendance?.excused ?? 0}</div>
              <div className="text-xs text-muted-foreground">Excused</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mission List */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Quest Log
        </h3>

        {missions && missions.length > 0 ? (
          <div className="space-y-2">
            {missions.map((mission) => {
              const status = getMissionStatus(mission.submission, mission.due_date);
              const isDueSoon = mission.due_date && !isPast(new Date(mission.due_date)) && 
                new Date(mission.due_date).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

              return (
                <div
                  key={mission.id}
                  className={`glass-panel p-4 rounded-xl border transition-all hover:border-primary/50 ${
                    status === "missing" ? "border-red-500/30 bg-red-500/5" : "border-border/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground truncate">{mission.title}</h4>
                        {isDueSoon && status === "active" && (
                          <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                            Due Soon!
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {mission.due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due: {format(new Date(mission.due_date), "MMM d, yyyy")}
                          </span>
                        )}
                        {mission.submission?.grade && (
                          <span className="flex items-center gap-1 text-green-500 font-semibold">
                            Grade: {mission.submission.grade}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(status)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No quests assigned yet</p>
            <p className="text-sm">Check back later for new missions!</p>
          </div>
        )}
      </div>
    </div>
  );
}
