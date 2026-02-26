import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ClassStats } from "@/hooks/useAssignmentAnalytics";

interface Props {
  byClass: Map<string, ClassStats>;
  enrolledPerClass: Map<string, Set<string>>;
}

export function AssignmentByClassView({ byClass, enrolledPerClass }: Props) {
  const classes = [...byClass.values()].sort((a, b) => b.assignmentCount - a.assignmentCount);
  const [selectedClass, setSelectedClass] = useState<string>("all");

  const chartData = classes.map((c) => ({
    name: c.className,
    submissions: Math.round(c.submissionRate),
    grading: Math.round(c.gradingRate),
  }));

  const selected = selectedClass !== "all" ? byClass.get(selectedClass) : null;
  const displayClasses = selected ? [selected] : classes;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.classId} value={c.classId}>{c.className}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClass === "all" && chartData.length > 0 && (
        <Card className="glass-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Submission & Grading Rates</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="submissions" name="Submission %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="grading" name="Grading %" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {displayClasses.map((cs) => {
        const enrolled = enrolledPerClass.get(cs.classId)?.size || 0;
        return (
          <Card key={cs.classId} className="glass-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{cs.className}</h3>
                <p className="text-xs text-muted-foreground">{cs.teacherName} · {enrolled} students enrolled · {cs.assignmentCount} assignments</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{cs.submissionRate.toFixed(0)}% submitted</Badge>
                <Badge variant="outline">{cs.gradingRate.toFixed(0)}% graded</Badge>
              </div>
            </div>
            {cs.assignments.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">Graded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cs.assignments.slice(0, 20).map((a) => {
                    const subs = a.submissions.filter((s) => s.status === "submitted" || s.status === "graded").length;
                    const graded = a.submissions.filter((s) => s.status === "graded").length;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.title}</TableCell>
                        <TableCell>{a.due_date || "—"}</TableCell>
                        <TableCell className="text-right">{subs}/{enrolled}</TableCell>
                        <TableCell className="text-right">{graded}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        );
      })}
    </div>
  );
}
