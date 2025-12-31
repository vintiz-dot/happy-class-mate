import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Zap, BarChart3 } from "lucide-react";
import { ClassLeaderboardShared } from "@/components/shared/ClassLeaderboardShared";
import { ManualPointsDialog } from "@/components/shared/ManualPointsDialog";
import { LiveAssessmentGrid } from "@/components/teacher/LiveAssessmentGrid";
import { Button } from "@/components/ui/button";

export default function TeacherLeaderboards() {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "live">("standard");

  const { data: activeClasses, isLoading } = useQuery({
    queryKey: ["teacher-leaderboard-classes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) return [];

      const { data } = await supabase
        .from("sessions")
        .select(`
          class_id,
          classes!inner(id, name)
        `)
        .eq("teacher_id", teacher.id)
        .gte("date", dayjs().subtract(3, "month").format("YYYY-MM-DD"));

      // Get unique classes
      const classMap = new Map();
      data?.forEach(s => {
        const classData = Array.isArray(s.classes) ? s.classes[0] : s.classes;
        if (classData && !classMap.has(classData.id)) {
          classMap.set(classData.id, classData);
        }
      });

      return Array.from(classMap.values());
    },
  });

  // Auto-select first class when loaded
  const displayClassId = selectedClassId || activeClasses?.[0]?.id;

  return (
    <Layout title="Class Leaderboards">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Class Leaderboards</h1>
              <p className="text-muted-foreground">Track student progress and achievements</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeClasses && activeClasses.length > 1 && (
              <Select
                value={displayClassId || ""}
                onValueChange={setSelectedClassId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {activeClasses.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={viewMode === "standard" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("standard")}
                className="rounded-none gap-1.5"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Standard</span>
              </Button>
              <Button
                variant={viewMode === "live" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("live")}
                className="rounded-none gap-1.5"
              >
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Live</span>
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading classes...
            </CardContent>
          </Card>
        ) : activeClasses && activeClasses.length > 0 ? (
          <div className="space-y-6">
            {displayClassId && viewMode === "standard" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      {activeClasses.find((c: any) => c.id === displayClassId)?.name}
                    </CardTitle>
                    <ManualPointsDialog classId={displayClassId} />
                  </div>
                </CardHeader>
                <CardContent>
                  <ClassLeaderboardShared classId={displayClassId} />
                </CardContent>
              </Card>
            )}

            {displayClassId && viewMode === "live" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Live Assessment — {activeClasses.find((c: any) => c.id === displayClassId)?.name}
                    </CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tap a student to quickly award skills. Long-press for sub-tags.
                  </p>
                </CardHeader>
                <CardContent>
                  <LiveAssessmentGrid classId={displayClassId} />
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No classes found. You will see leaderboards here once you are assigned to teach classes.
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
