import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Receipt, BookOpen } from "lucide-react";
import { format, isToday, isFuture } from "date-fns";
import { Link } from "react-router-dom";

export default function StudentDashboard() {
  const { studentId } = useStudentProfile();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["student-dashboard", studentId],
    queryFn: async () => {
      if (!studentId) return null;

      // Get upcoming sessions
      const today = new Date().toISOString().split("T")[0];
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data: sessions } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          classes(name)
        `)
        .in("class_id", classIds)
        .gte("date", today)
        .in("status", ["Scheduled"])
        .order("date")
        .limit(5);

      // Get pending homework
      const { data: homework } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          due_date,
          classes(name)
        `)
        .in("class_id", classIds)
        .gte("due_date", today)
        .order("due_date")
        .limit(5);

      const { data: submissions } = await supabase
        .from("homework_submissions")
        .select("homework_id, status")
        .eq("student_id", studentId);

      const submissionMap = new Map(submissions?.map(s => [s.homework_id, s.status]) || []);

      // Get current month tuition
      const currentMonth = format(new Date(), "yyyy-MM");
      const { data: tuition } = await supabase.functions.invoke("calculate-tuition", {
        body: { studentId, month: currentMonth },
      });

      return {
        sessions: sessions || [],
        homework: homework?.map(hw => ({
          ...hw,
          submissionStatus: submissionMap.get(hw.id) || "pending",
        })) || [],
        tuition: tuition.data,
      };
    },
    enabled: !!studentId,
  });

  if (!studentId) {
    return (
      <Layout title="Dashboard">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select a student profile to view dashboard</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Dashboard">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <p className="text-muted-foreground">Your upcoming classes and assignments</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Sessions</CardDescription>
              <CardTitle className="text-3xl">{dashboardData?.sessions.length || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Homework</CardDescription>
              <CardTitle className="text-3xl">
                {dashboardData?.homework.filter(h => h.submissionStatus === "pending").length || 0}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Month's Balance</CardDescription>
              <CardTitle className="text-3xl">
                {dashboardData?.tuition?.totalAmount?.toLocaleString() || 0} ₫
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Classes
              </CardTitle>
              <CardDescription>Your next scheduled sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData?.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming sessions</p>
              ) : (
                dashboardData?.sessions.map((session: any) => (
                  <Link key={session.id} to="/schedule">
                    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{session.classes.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(session.date), "MMM d, yyyy")} • {session.start_time?.slice(0, 5)}
                          </p>
                        </div>
                        {isToday(new Date(session.date)) && (
                          <Badge>Today</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Homework & Assignments
              </CardTitle>
              <CardDescription>Pending assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData?.homework.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending homework</p>
              ) : (
                dashboardData?.homework.map((hw: any) => (
                  <Link key={hw.id} to="/student/assignments">
                    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{hw.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {hw.classes.name} • Due {format(new Date(hw.due_date), "MMM d")}
                          </p>
                        </div>
                        <Badge variant={hw.submissionStatus === "submitted" ? "default" : "outline"}>
                          {hw.submissionStatus === "pending" ? "Not Submitted" : hw.submissionStatus}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link to="/tuition">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  View Tuition & Payments
                </CardTitle>
                <CardDescription>Check your balance and payment history</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/schedule">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  View Full Schedule
                </CardTitle>
                <CardDescription>See all your classes and attendance</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
