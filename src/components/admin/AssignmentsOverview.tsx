import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssignmentCalendar } from "@/components/assignments/AssignmentCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Calendar as CalendarIcon, ListChecks } from "lucide-react";

export function AssignmentsOverview() {
  const { data: assignments } = useQuery({
    queryKey: ["admin-assignments-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          due_date,
          class_id,
          classes!inner(name),
          homework_submissions(
            id,
            status,
            student_id
          )
        `)
        .order("due_date", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const getStats = () => {
    if (!assignments) return { total: 0, pending: 0, graded: 0 };
    
    const total = assignments.length;
    let totalSubmissions = 0;
    let gradedSubmissions = 0;

    assignments.forEach(hw => {
      const subs = hw.homework_submissions || [];
      totalSubmissions += subs.length;
      gradedSubmissions += subs.filter((s: any) => s.status === "graded").length;
    });

    return {
      total,
      totalSubmissions,
      gradedSubmissions,
      pendingSubmissions: totalSubmissions - gradedSubmissions,
    };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Assignments Overview
        </h2>
        <p className="text-muted-foreground">Track all assignments across classes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-sm p-4">
          <div className="text-sm text-muted-foreground">Total Assignments</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="text-sm text-muted-foreground">Total Submissions</div>
          <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="text-sm text-muted-foreground">Graded</div>
          <div className="text-2xl font-bold text-success">{stats.gradedSubmissions}</div>
        </Card>
        <Card className="glass-sm p-4">
          <div className="text-sm text-muted-foreground">Pending Grading</div>
          <div className="text-2xl font-bold text-warning">{stats.pendingSubmissions}</div>
        </Card>
      </div>

      {/* Calendar and List View */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <ListChecks className="h-4 w-4" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <AssignmentCalendar role="admin" />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="glass-sm">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-3">
                {assignments?.map((assignment) => {
                  const submissions = assignment.homework_submissions || [];
                  const gradedCount = submissions.filter((s: any) => s.status === "graded").length;
                  const submittedCount = submissions.filter((s: any) => s.status === "submitted").length;
                  
                  return (
                    <Card key={assignment.id} className="glass-sm p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold">{assignment.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {assignment.classes.name}
                          </p>
                          <div className="flex gap-2 mt-2 text-xs">
                            <Badge variant="outline">
                              Due: {assignment.due_date || "No date"}
                            </Badge>
                            <Badge variant="secondary">
                              {submissions.length} submissions
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-sm">
                            <span className="text-success font-medium">{gradedCount}</span>
                            <span className="text-muted-foreground"> graded</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-warning font-medium">{submittedCount}</span>
                            <span className="text-muted-foreground"> pending</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
