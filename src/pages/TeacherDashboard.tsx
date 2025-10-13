import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, DollarSign, Users, Clock } from "lucide-react";
import { format, isToday } from "date-fns";
import { Link } from "react-router-dom";
import { dayjs } from "@/lib/date";

export default function TeacherDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) throw new Error("Teacher not found");

      // Get today's sessions
      const today = new Date().toISOString().split("T")[0];
      const { data: todaySessions } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          classes(name)
        `)
        .eq("teacher_id", teacher.id)
        .eq("date", today)
        .order("start_time");

      // Get upcoming sessions (next 5 days)
      const { data: upcomingSessions } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          classes(name)
        `)
        .eq("teacher_id", teacher.id)
        .gte("date", today)
        .in("status", ["Scheduled"])
        .order("date")
        .order("start_time")
        .limit(5);

      // Get classes taught
      const { data: classesData } = await supabase
        .from("sessions")
        .select("class_id, classes!inner(id, name)")
        .eq("teacher_id", teacher.id)
        .gte("date", dayjs().startOf("month").format("YYYY-MM-DD"));

      const uniqueClasses = Array.from(
        new Map(classesData?.map((s: any) => [s.class_id, s.classes]) || []).values()
      );

      // Get current month payroll
      const currentMonth = dayjs().format("YYYY-MM");
      const { data: payroll } = await supabase
        .from("payroll_summaries")
        .select("*")
        .eq("teacher_id", teacher.id)
        .eq("month", currentMonth)
        .maybeSingle();

      // Get pending homework submissions to grade
      const classIds = uniqueClasses.map((c: any) => c.id);
      const { data: homeworks } = await supabase
        .from("homeworks")
        .select("id")
        .in("class_id", classIds);

      const homeworkIds = homeworks?.map(h => h.id) || [];
      const { data: pendingSubmissions } = await supabase
        .from("homework_submissions")
        .select("id")
        .in("homework_id", homeworkIds)
        .eq("status", "submitted");

      return {
        todaySessions: todaySessions || [],
        upcomingSessions: upcomingSessions || [],
        classes: uniqueClasses,
        payroll,
        pendingSubmissions: pendingSubmissions?.length || 0,
      };
    },
  });

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
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Your schedule and teaching overview</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Sessions</CardDescription>
              <CardTitle className="text-3xl">{dashboardData?.todaySessions.length || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Classes</CardDescription>
              <CardTitle className="text-3xl">{dashboardData?.classes.length || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Grading</CardDescription>
              <CardTitle className="text-3xl">{dashboardData?.pendingSubmissions || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Month's Earnings</CardDescription>
              <CardTitle className="text-3xl">
                {dashboardData?.payroll?.total_amount?.toLocaleString() || 0} ₫
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Schedule
              </CardTitle>
              <CardDescription>Your sessions for today</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData?.todaySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions today</p>
              ) : (
                dashboardData?.todaySessions.map((session: any) => (
                  <Link key={session.id} to="/teacher/attendance">
                    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{session.classes.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                          </p>
                        </div>
                        <Badge variant={session.status === "Held" ? "default" : "outline"}>
                          {session.status}
                        </Badge>
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
                <Calendar className="h-5 w-5" />
                Upcoming Sessions
              </CardTitle>
              <CardDescription>Next 5 scheduled classes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData?.upcomingSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming sessions</p>
              ) : (
                dashboardData?.upcomingSessions.slice(0, 5).map((session: any) => (
                  <div key={session.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{session.classes.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.date), "MMM d")} • {session.start_time?.slice(0, 5)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link to="/teacher/attendance">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Mark Attendance
                </CardTitle>
                <CardDescription>Record student attendance for today</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/teacher/assignments">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Manage Assignments
                </CardTitle>
                <CardDescription>Create and grade homework</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/teacher/payroll">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  View Payroll
                </CardTitle>
                <CardDescription>Check your earnings and sessions</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
