import { Card } from "@/components/ui/card";
import { GlobalStats, PointBucket } from "@/hooks/useAssignmentAnalytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BookOpen, CheckCircle, Clock, TrendingUp } from "lucide-react";
import type { AssignmentRecord } from "@/hooks/useAssignmentAnalytics";
import { dayjs } from "@/lib/date";

interface Props {
  global: GlobalStats;
  assignments: AssignmentRecord[];
  pointBuckets: PointBucket[];
  byClass: Map<string, { className: string; submissionRate: number }>;
}

export function AssignmentGlobalView({ global, assignments, pointBuckets = [], byClass }: Props) {
  const classChartData = [...byClass.values()]
    .map((c) => ({ name: c.className, rate: Math.round(c.submissionRate) }))
    .sort((a, b) => b.rate - a.rate);

  const hasPointData = pointBuckets.some((b) => b.count > 0);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-sm p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" /> Assignments</div>
          <div className="text-2xl font-bold mt-1">{global.totalAssignments}</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" /> Submission Rate</div>
          <div className="text-2xl font-bold mt-1">{global.submissionRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">{global.totalSubmissions} / {global.totalExpectedSubmissions} expected</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4" /> Graded</div>
          <div className="text-2xl font-bold mt-1">{global.gradedCount}</div>
          <div className="text-xs text-muted-foreground">{global.gradedRate.toFixed(0)}% of submissions</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Avg Grading</div>
          <div className="text-2xl font-bold mt-1">{global.avgGradingDays !== null ? `${global.avgGradingDays.toFixed(1)}d` : "—"}</div>
          <div className="text-xs text-muted-foreground">{global.pendingGrading} pending</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {classChartData.length > 0 && (
          <Card className="glass-sm p-4">
            <h3 className="text-sm font-semibold mb-3">Submission Rate by Class</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={classChartData} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {hasPointData && (
          <Card className="glass-sm p-4">
            <h3 className="text-sm font-semibold mb-3">Points Distribution (Homework)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pointBuckets}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v: number) => `${v} students`} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
