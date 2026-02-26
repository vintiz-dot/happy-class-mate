import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Search } from "lucide-react";
import type { StudentStats } from "@/hooks/useAssignmentAnalytics";

interface Props {
  byStudent: Map<string, StudentStats>;
}

export function AssignmentByStudentView({ byStudent }: Props) {
  const [search, setSearch] = useState("");
  const students = useMemo(() => {
    const all = [...byStudent.values()].sort((a, b) => b.assignedCount - a.assignedCount);
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((s) => s.studentName.toLowerCase().includes(q));
  }, [byStudent, search]);

  // Top chart: submission rates of top 15 students
  const chartData = [...byStudent.values()]
    .filter((s) => s.assignedCount > 0)
    .sort((a, b) => a.submissionRate - b.submissionRate)
    .slice(0, 15)
    .map((s) => ({ name: s.studentName.split(" ").pop() || s.studentName, rate: Math.round(s.submissionRate) }));

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {!search && chartData.length > 0 && (
        <Card className="glass-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Submission Rates (lowest first)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="glass-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Submitted</TableHead>
              <TableHead className="text-right">Graded</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Grades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.slice(0, 50).map((s) => (
              <TableRow key={s.studentId}>
                <TableCell className="font-medium">{s.studentName}</TableCell>
                <TableCell className="text-right">{s.assignedCount}</TableCell>
                <TableCell className="text-right">{s.submittedCount}</TableCell>
                <TableCell className="text-right">{s.gradedCount}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={s.submissionRate >= 80 ? "default" : s.submissionRate >= 50 ? "secondary" : "destructive"}>
                    {s.submissionRate.toFixed(0)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {s.grades.length > 0 ? s.grades.slice(0, 5).join(", ") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {students.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No students found</p>
        )}
      </Card>
    </div>
  );
}
