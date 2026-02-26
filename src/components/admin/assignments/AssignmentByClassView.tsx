import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import type { ClassStats } from "@/hooks/useAssignmentAnalytics";

interface Props {
  byClass: Map<string, ClassStats>;
  enrolledPerClass: Map<string, Set<string>>;
}

export function AssignmentByClassView({ byClass, enrolledPerClass }: Props) {
  const classes = [...byClass.values()].sort((a, b) => b.assignmentCount - a.assignmentCount);
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenClasses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const chartData = classes.map((c) => ({
    name: c.className,
    submissions: Math.round(c.submissionRate),
    grading: Math.round(c.gradingRate),
  }));

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
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

      <div className="space-y-2">
        {classes.map((cs) => {
          const enrolled = enrolledPerClass.get(cs.classId)?.size || 0;
          const isOpen = openClasses.has(cs.classId);
          return (
            <Collapsible key={cs.classId} open={isOpen} onOpenChange={() => toggle(cs.classId)}>
              <Card className="glass-sm overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <div className="text-left">
                      <h3 className="font-semibold">{cs.className}</h3>
                      <p className="text-xs text-muted-foreground">{cs.teacherName} · {enrolled} students · {cs.assignmentCount} assignments</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{cs.submissionRate.toFixed(0)}% submitted</Badge>
                    <Badge variant="outline">{cs.gradingRate.toFixed(0)}% graded</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
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
                          {cs.assignments.map((a) => {
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
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
