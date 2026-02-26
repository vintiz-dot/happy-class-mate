import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeacherStats } from "@/hooks/useAssignmentAnalytics";

interface Props {
  byTeacher: Map<string, TeacherStats>;
}

export function AssignmentByTeacherView({ byTeacher }: Props) {
  const teachers = [...byTeacher.values()].filter((t) => t.teacherId !== "unassigned").sort((a, b) => b.assignmentCount - a.assignmentCount);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");

  const display = selectedTeacher !== "all" ? teachers.filter((t) => t.teacherId === selectedTeacher) : teachers;

  return (
    <div className="space-y-6">
      <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="All Teachers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Teachers</SelectItem>
          {teachers.map((t) => (
            <SelectItem key={t.teacherId} value={t.teacherId}>{t.teacherName}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {display.map((ts) => (
        <Card key={ts.teacherId} className="glass-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{ts.teacherName}</h3>
              <p className="text-xs text-muted-foreground">{ts.classCount} classes · {ts.assignmentCount} assignments</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{ts.gradingRate.toFixed(0)}% graded</Badge>
              <Badge variant="outline">{ts.avgTurnaroundDays !== null ? `${ts.avgTurnaroundDays.toFixed(1)}d turnaround` : "No data"}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Submissions</div>
              <div className="text-lg font-bold">{ts.totalSubmissions}</div>
            </Card>
            <Card className="p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Graded</div>
              <div className="text-lg font-bold text-success">{ts.gradedCount}</div>
            </Card>
            <Card className="p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-lg font-bold text-warning">{ts.totalSubmissions - ts.gradedCount}</div>
            </Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="text-right">Graded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ts.assignments.slice(0, 15).map((a) => {
                const subs = a.submissions.filter((s) => s.status === "submitted" || s.status === "graded").length;
                const graded = a.submissions.filter((s) => s.status === "graded").length;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.className}</TableCell>
                    <TableCell>{a.due_date || "—"}</TableCell>
                    <TableCell className="text-right">{subs}</TableCell>
                    <TableCell className="text-right">{graded}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ))}

      {display.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No teacher data available</p>
      )}
    </div>
  );
}
