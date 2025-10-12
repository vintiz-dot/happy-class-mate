import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export function ScheduleCalendar({ role }: { role: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", year, month, role],
    queryFn: async () => {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      let query = supabase
        .from("sessions")
        .select(`
          *,
          classes:class_id(name, session_rate_vnd),
          teachers:teacher_id(full_name)
        `)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date")
        .order("start_time");

      // Filter for teachers
      if (role === "teacher") {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: teacher } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", user?.id)
          .single();
        
        if (teacher) {
          query = query.eq("teacher_id", teacher.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
  };

  const monthName = currentDate.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  // Group sessions by date
  const sessionsByDate = sessions?.reduce((acc: any, session: any) => {
    const date = session.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(session);
    return acc;
  }, {}) || {};

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Held":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "Canceled":
        return "bg-red-500/10 text-red-700 border-red-500/20";
      default:
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    }
  };

  if (isLoading) {
    return <div>Đang tải lịch học...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Lịch học tháng {monthName}</CardTitle>
          <div className="flex gap-2">
            <Button onClick={goToPreviousMonth} variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={goToNextMonth} variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.keys(sessionsByDate).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Không có buổi học nào trong tháng này
            </p>
          ) : (
            Object.entries(sessionsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, dateSessions]: [string, any]) => (
                <div key={date} className="space-y-2">
                  <h3 className="font-semibold text-sm">
                    {new Date(date).toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h3>
                  <div className="space-y-2 pl-4">
                    {dateSessions.map((session: any) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{session.classes?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.start_time} - {session.end_time}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            GV: {session.teachers?.full_name}
                          </p>
                        </div>
                        <Badge className={getStatusColor(session.status)}>
                          {session.status === "Scheduled" && "Đã lên lịch"}
                          {session.status === "Held" && "Đã học"}
                          {session.status === "Canceled" && "Đã hủy"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
