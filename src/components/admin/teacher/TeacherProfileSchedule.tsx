import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CalendarMonth from "@/components/calendar/CalendarMonth";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TeacherProfileScheduleProps {
  teacherId: string;
  selectedMonth: string;
}

export function TeacherProfileSchedule({ teacherId, selectedMonth }: TeacherProfileScheduleProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ["teacher-schedule", teacherId, selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("sessions")
        .select(`
          *,
          classes!inner(name)
        `)
        .eq("teacher_id", teacherId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const selectedDaySessions = selectedDate
    ? sessions?.filter((s) => s.date === selectedDate)
    : [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Calendar</CardTitle>
          <CardDescription>Click a day to see sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarMonth
            month={selectedMonth}
            events={
              sessions?.map((s: any) => ({
                id: s.id,
                date: s.date,
                start_time: s.start_time,
                end_time: s.end_time,
                class_name: s.classes.name,
                status: s.status,
              })) || []
            }
            onSelectDay={setSelectedDate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDate ? new Date(selectedDate).toLocaleDateString() : "Select a Date"}
          </CardTitle>
          <CardDescription>
            {selectedDaySessions.length > 0
              ? `${selectedDaySessions.length} session(s)`
              : "No sessions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedDaySessions.length > 0 ? (
            <div className="space-y-3">
              {selectedDaySessions.map((session: any) => (
                <div key={session.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{session.classes.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <Badge variant={session.status === "Held" ? "default" : "secondary"} className={session.status === "Held" ? "bg-green-500" : ""}>
                    {session.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              {selectedDate ? "No sessions on this day" : "Click a date on the calendar"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
