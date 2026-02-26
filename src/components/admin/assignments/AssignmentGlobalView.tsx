import { Card } from "@/components/ui/card";
import { GlobalStats } from "@/hooks/useAssignmentAnalytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BookOpen, CheckCircle, Clock, TrendingUp } from "lucide-react";
import type { AssignmentRecord } from "@/hooks/useAssignmentAnalytics";
import { dayjs } from "@/lib/date";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)"];

interface Props {
  global: GlobalStats;
  assignments: AssignmentRecord[];
  gradeDistribution: Map<string, number>;
  byClass: Map<string, { className: string; submissionRate: number }>;
}

export function AssignmentGlobalView({ global, assignments, gradeDistribution, byClass }: Props) {
  // Submission rate by class for bar chart
  const classChartData = [...byClass.values()]
    .map((c) => ({ name: c.className, rate: Math.round(c.submissionRate) }))
    .sort((a, b) => b.rate - a.rate);

  // Grade distribution for pie chart
  const gradeData = [...gradeDistribution.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Submission trend: last 6 months
  const trendData: { month: string; rate: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = dayjs().subtract(i, "month");
    const monthStr = m.format("YYYY-MM");
    const monthAssignments = assignments.filter((a) => a.due_date && a.due_date.startsWith(monthStr));
    if (monthAssignments.length === 0) {
      trendData.push({ month: m.format("MMM"), rate: 0 });
      continue;
    }
    const totalSubs = monthAssignments.reduce((sum, a) => sum + a.submissions.filter((s) => s.status === "submitted" || s.status === "graded").length, 0);
    const totalAssignments = monthAssignments.length;
    trendData.push({ month: m.format("MMM"), rate: totalAssignments > 0 ? Math.round((totalSubs / totalAssignments) * 100) / 100 : 0 });
  }

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
          <div className="text-2xl font-bold text-success mt-1">{global.gradedCount}</div>
          <div className="text-xs text-muted-foreground">{global.gradedRate.toFixed(0)}% of submissions</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Avg Grading</div>
          <div className="text-2xl font-bold text-warning mt-1">{global.avgGradingDays !== null ? `${global.avgGradingDays.toFixed(1)}d` : "—"}</div>
          <div className="text-xs text-muted-foreground">{global.pendingGrading} pending</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission rate by class */}
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

        {/* Grade distribution */}
        {gradeData.length > 0 && (
          <Card className="glass-sm p-4">
            <h3 className="text-sm font-semibold mb-3">Grade Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`}>
                  {gradeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
