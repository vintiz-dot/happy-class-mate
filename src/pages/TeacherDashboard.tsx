import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, DollarSign, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import TeacherScheduleCalendar from "@/components/teacher/TeacherScheduleCalendar";

export default function TeacherDashboard() {
  const currentMonth = dayjs().format("YYYY-MM");

  const { data: todaySessions } = useQuery({
    queryKey: ["teacher-today-sessions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) return [];

      const today = dayjs().format("YYYY-MM-DD");

      const { data } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          classes!inner(name)
        `)
        .eq("teacher_id", teacher.id)
        .eq("date", today)
        .order("start_time", { ascending: true });

      return data || [];
    },
  });

  const { data: activeClasses } = useQuery({
    queryKey: ["teacher-active-classes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) return 0;

      const { data } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("teacher_id", teacher.id)
        .gte("date", dayjs().format("YYYY-MM-DD"));

      const uniqueClasses = new Set(data?.map(s => s.class_id));
      return uniqueClasses.size;
    },
  });

  const { data: pendingGrading } = useQuery({
    queryKey: ["teacher-pending-grading"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) return 0;

      // Get teacher's classes
      const { data: sessions } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      const classIds = [...new Set(sessions?.map(s => s.class_id))];

      // Get homeworks for these classes
      const { data: homeworks } = await supabase
        .from("homeworks")
        .select("id")
        .in("class_id", classIds);

      const homeworkIds = homeworks?.map(h => h.id) || [];

      // Count pending submissions
      const { count } = await supabase
        .from("homework_submissions")
        .select("*", { count: "exact", head: true })
        .in("homework_id", homeworkIds)
        .eq("status", "submitted");

      return count || 0;
    },
  });

  const { data: payrollData } = useQuery({
    queryKey: ["teacher-payroll", currentMonth],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) return null;

      const { data, error } = await supabase.functions.invoke("calculate-payroll", {
        body: { month: currentMonth, teacherId: teacher.id },
      });

      if (error) throw error;
      return data?.payrollData?.[0] || null;
    },
  });

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Sessions</CardDescription>
              <CardTitle className="text-3xl">{todaySessions?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {dayjs().format("MMM D, YYYY")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Classes</CardDescription>
              <CardTitle className="text-3xl">{activeClasses || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Teaching this term</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Grading</CardDescription>
              <CardTitle className="text-3xl">{pendingGrading || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Submissions to review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Earned (Actual)</CardDescription>
              <CardTitle className="text-3xl">
                {(payrollData?.totalAmountActual || 0).toLocaleString()} ₫
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {payrollData?.sessionsCountActual || 0} held sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Projected Total</CardDescription>
              <CardTitle className="text-3xl">
                {(payrollData?.totalAmountProjected || 0).toLocaleString()} ₫
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {payrollData?.sessionsCountProjected || 0} total sessions
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySessions && todaySessions.length > 0 ? (
              <div className="space-y-3">
                {todaySessions.map((session: any) => (
                  <div key={session.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{session.classes.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <Badge variant={session.status === "Held" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                  </div>
                ))}
                <Link to="/teacher/attendance">
                  <Button variant="outline" className="w-full">Mark Attendance</Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No sessions scheduled for today</p>
                <Link to="/schedule">
                  <Button variant="outline" className="mt-4">View Full Schedule</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/teacher/attendance">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Attendance
                </CardTitle>
                <CardDescription>Mark student attendance</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/teacher/assignments">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Assignments
                </CardTitle>
                <CardDescription>Manage homework and grading</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/teacher/payroll">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payroll
                </CardTitle>
                <CardDescription>View earnings and sessions</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Teaching Schedule</h2>
          <TeacherScheduleCalendar />
        </div>
      </div>
    </Layout>
  );
}
