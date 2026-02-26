import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Search } from "lucide-react";
import type { StudentStats, AssignmentRecord } from "@/hooks/useAssignmentAnalytics";

interface Props {
  byStudent: Map<string, StudentStats>;
  assignments: AssignmentRecord[];
  homeworkPointsMap: Map<string, Map<string, number>>;
}

export function AssignmentByStudentView({ byStudent, assignments, homeworkPointsMap }: Props) {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null>(null);

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

  // Detail data for selected student
  const studentDetail = useMemo(() => {
    if (!selectedStudent) return [];
    const classSet = new Set(selectedStudent.classIds);
    const relevant = assignments.filter((a) => classSet.has(a.class_id));
    const pointsMap = homeworkPointsMap.get(selectedStudent.studentId) || new Map();
    return relevant.map((a) => {
      const sub = a.submissions.find((s) => s.student_id === selectedStudent.studentId);
      return {
        id: a.id,
        title: a.title,
        className: a.className,
        dueDate: a.due_date || "—",
        status: sub?.status || "not_submitted",
        grade: sub?.grade || "—",
        points: pointsMap.get(a.id) ?? "—",
        submittedAt: sub?.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—",
      };
    });
  }, [selectedStudent, assignments, homeworkPointsMap]);

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
              <TableRow
                key={s.studentId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedStudent(s)}
              >
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

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedStudent.studentName}</DialogTitle>
                <DialogDescription>Assignment details & performance</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">Assigned</div>
                  <div className="text-lg font-bold">{selectedStudent.assignedCount}</div>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">Submitted</div>
                  <div className="text-lg font-bold">{selectedStudent.submittedCount}</div>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">Graded</div>
                  <div className="text-lg font-bold">{selectedStudent.gradedCount}</div>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">Rate</div>
                  <div className="text-lg font-bold">{selectedStudent.submissionRate.toFixed(0)}%</div>
                </Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentDetail.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell className="text-xs">{d.className}</TableCell>
                      <TableCell className="text-xs">{d.dueDate}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "graded" ? "default" : d.status === "submitted" ? "secondary" : "outline"} className="text-xs">
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.grade}</TableCell>
                      <TableCell className="text-right">{d.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
