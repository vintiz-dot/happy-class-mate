import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TeacherStats } from "@/hooks/useAssignmentAnalytics";

interface Props {
  byTeacher: Map<string, TeacherStats>;
}

export function AssignmentByTeacherView({ byTeacher }: Props) {
  const teachers = [...byTeacher.values()].filter((t) => t.teacherId !== "unassigned").sort((a, b) => b.assignmentCount - a.assignmentCount);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [classFilters, setClassFilters] = useState<Map<string, Set<string>>>(new Map());

  const display = selectedTeacher !== "all" ? teachers.filter((t) => t.teacherId === selectedTeacher) : teachers;

  const getActiveClasses = (teacherId: string, allClassIds: string[]) => {
    const filter = classFilters.get(teacherId);
    if (!filter || filter.size === 0) return new Set(allClassIds);
    return filter;
  };

  const toggleClassFilter = (teacherId: string, values: string[]) => {
    setClassFilters((prev) => {
      const next = new Map(prev);
      next.set(teacherId, new Set(values));
      return next;
    });
  };

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

      {display.map((ts) => {
        const activeClasses = getActiveClasses(ts.teacherId, ts.classIds);
        const filteredAssignments = ts.assignments.filter((a) => activeClasses.has(a.class_id));
        const filteredSubs = filteredAssignments.reduce((n, a) => n + a.submissions.filter((s) => s.status === "submitted" || s.status === "graded").length, 0);
        const filteredGraded = filteredAssignments.reduce((n, a) => n + a.submissions.filter((s) => s.status === "graded").length, 0);

        return (
          <Card key={ts.teacherId} className="glass-sm p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold">{ts.teacherName}</h3>
                <p className="text-xs text-muted-foreground">{ts.classCount} classes · {ts.assignmentCount} assignments</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{ts.gradingRate.toFixed(0)}% graded</Badge>
                <Badge variant="outline">{ts.avgTurnaroundDays !== null ? `${ts.avgTurnaroundDays.toFixed(1)}d turnaround` : "No data"}</Badge>
              </div>
            </div>

            {ts.classIds.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Filter by class:</p>
                <ToggleGroup
                  type="multiple"
                  value={[...activeClasses]}
                  onValueChange={(vals) => toggleClassFilter(ts.teacherId, vals)}
                  className="flex flex-wrap gap-1"
                >
                  {ts.classIds.map((cid, i) => (
                    <ToggleGroupItem key={cid} value={cid} size="sm" variant="outline" className="text-xs">
                      {ts.classNames[i]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground">Submissions</div>
                <div className="text-lg font-bold">{filteredSubs}</div>
              </Card>
              <Card className="p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground">Graded</div>
                <div className="text-lg font-bold">{filteredGraded}</div>
              </Card>
              <Card className="p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-lg font-bold">{filteredSubs - filteredGraded}</div>
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
                {filteredAssignments.slice(0, 20).map((a) => {
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
        );
      })}

      {display.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No teacher data available</p>
      )}
    </div>
  );
}
