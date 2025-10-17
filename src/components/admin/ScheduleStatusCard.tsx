import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TeacherReport {
  teacher_id: string | null;
  teacher_name: string;
  scheduled_minutes: number;
  held_minutes: number;
  sessions: Array<{
    id: string;
    class_id: string;
    class_name: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
  }>;
}

interface ScheduleReport {
  success: boolean;
  month: string;
  normalized: number;
  created: number[];
  skippedConflicts: any[];
  attention: {
    noTeacherExpected: any[];
    noTeacherExisting: any[];
  };
  perTeacher: TeacherReport[];
}

export function ScheduleStatusCard({ month }: { month?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: report, refetch, isLoading } = useQuery({
    queryKey: ['schedule-status', month],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('schedule-sessions', {
        body: { month },
      });
      if (error) throw error;
      return data as ScheduleReport;
    },
    enabled: false, // Only fetch when explicitly triggered
  });

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Check Status
          </Button>
        </div>
      </CardHeader>
      
      {report && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant={report.success ? "default" : "destructive"}>
              {report.success ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Success
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Failed
                </>
              )}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Month: {report.month}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{report.created?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Created</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{report.normalized || 0}</div>
              <div className="text-xs text-muted-foreground">Normalized</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{report.skippedConflicts?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Conflicts</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {(report.attention?.noTeacherExpected?.length || 0) + 
                 (report.attention?.noTeacherExisting?.length || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Attention Needed</div>
            </div>
          </div>

          {report.perTeacher && report.perTeacher.length > 0 && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Teacher Schedule ({report.perTeacher.length})
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {isOpen ? 'Hide' : 'Show'} details
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                {report.perTeacher.map((teacher) => (
                  <div key={teacher.teacher_id || 'unassigned'} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{teacher.teacher_name}</div>
                      <Badge variant="secondary">{teacher.sessions.length} sessions</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Scheduled:</span>{' '}
                        <span className="font-medium">{formatHours(teacher.scheduled_minutes)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Held:</span>{' '}
                        <span className="font-medium">{formatHours(teacher.held_minutes)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {report.attention && (
            (report.attention.noTeacherExpected?.length > 0 || 
             report.attention.noTeacherExisting?.length > 0) && (
              <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-3 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Attention Required
                    </div>
                    {report.attention.noTeacherExpected?.length > 0 && (
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        {report.attention.noTeacherExpected.length} template slots have no teacher assigned
                      </div>
                    )}
                    {report.attention.noTeacherExisting?.length > 0 && (
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        {report.attention.noTeacherExisting.length} existing sessions need teacher assignment
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </CardContent>
      )}

      {!report && !isLoading && (
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Click "Check Status" to view the current schedule state
          </p>
        </CardContent>
      )}
    </Card>
  );
}
