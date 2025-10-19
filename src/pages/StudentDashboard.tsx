import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, DollarSign, Clock, Phone } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function StudentDashboard() {
  const { studentId } = useStudentProfile();
  const navigate = useNavigate();
  const currentMonth = dayjs().format("YYYY-MM");

  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data } = await supabase
        .from("students")
        .select(`
          id, 
          full_name, 
          email, 
          phone, 
          is_active,
          family:families(name),
          updated_at
        `)
        .eq("id", studentId)
        .single();
      return data;
    },
    enabled: !!studentId,
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ["student-upcoming-sessions", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

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
        .in("class_id", classIds)
        .gte("date", dayjs().format("YYYY-MM-DD"))
        .lte("date", dayjs().add(7, "days").format("YYYY-MM-DD"))
        .in("status", ["Scheduled", "Held"])
        .order("date", { ascending: true })
        .limit(5);

      return data || [];
    },
    enabled: !!studentId,
  });

  const { data: pendingHomework } = useQuery({
    queryKey: ["student-pending-homework", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data: homeworks } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          due_date,
          classes(name)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: true });

      // Filter out submitted homework
      const pending = [];
      for (const hw of homeworks || []) {
        const { data: submission } = await supabase
          .from("homework_submissions")
          .select("id, status")
          .eq("homework_id", hw.id)
          .eq("student_id", studentId)
          .maybeSingle();

        if (!submission || submission.status === "pending") {
          pending.push(hw);
        }
      }

      return pending.slice(0, 5);
    },
    enabled: !!studentId,
  });

  const { data: tuitionData } = useQuery({
    queryKey: ["student-tuition-summary", studentId, currentMonth],
    queryFn: async () => {
      if (!studentId) return null;

      // Fetch invoice from database (same as admin)
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", studentId)
        .eq("month", currentMonth)
        .maybeSingle();

      if (error) throw error;

      return {
        totalAmount: invoice?.total_amount || 0,
        balance: invoice ? invoice.total_amount - invoice.paid_amount : 0,
      };
    },
    enabled: !!studentId,
  });

  const { data: leaderboards } = useQuery({
    queryKey: ["student-leaderboards", studentId, currentMonth],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id, classes(name)")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data } = await supabase
        .from("student_points")
        .select(`
          id,
          class_id,
          total_points,
          participation_points,
          homework_points,
          classes(name)
        `)
        .eq("student_id", studentId)
        .in("class_id", classIds)
        .eq("month", currentMonth);

      return data || [];
    },
    enabled: !!studentId,
  });

  if (!studentId || !studentProfile) {
    return (
      <Layout title="Dashboard">
        <p className="text-center text-muted-foreground">Please select a student profile.</p>
      </Layout>
    );
  }

  return (
    <Layout title={`Dashboard - ${studentProfile.full_name}`}>
      <div className="space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                  {studentProfile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold">{studentProfile.full_name}</h1>
                    <Badge variant={studentProfile.is_active ? "default" : "secondary"} className={studentProfile.is_active ? "bg-green-500" : ""}>
                      {studentProfile.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    {studentProfile.family?.name && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Family:</span>
                        <span>{studentProfile.family.name}</span>
                      </div>
                    )}
                    {studentProfile.email && (
                      <div className="flex items-center gap-2">
                        <span>{studentProfile.email}</span>
                      </div>
                    )}
                    {studentProfile.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{studentProfile.phone}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(studentProfile.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Sessions</CardDescription>
              <CardTitle className="text-3xl">{upcomingSessions?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Homework</CardDescription>
              <CardTitle className="text-3xl">{pendingHomework?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Assignments to complete</p>
            </CardContent>
          </Card>

          <div onClick={() => navigate('/tuition')} className="cursor-pointer">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription>Current Balance</CardDescription>
                <CardTitle className="text-3xl">
                  {tuitionData?.balance?.toLocaleString() || 0} ₫
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {dayjs().format("MMMM YYYY")} • Click to view details
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((session: any) => (
                    <div key={session.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{session.classes.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {dayjs(session.date).format("MMM D, YYYY")} • {session.start_time.slice(0, 5)}
                        </p>
                      </div>
                      <Badge>{session.status}</Badge>
                    </div>
                  ))}
                  <Link to="/schedule">
                    <Button variant="outline" className="w-full">View Full Schedule</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No upcoming sessions</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Pending Homework
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingHomework && pendingHomework.length > 0 ? (
                <div className="space-y-3">
                  {pendingHomework.map((hw: any) => (
                    <div key={hw.id} className="p-3 border rounded-lg">
                      <p className="font-medium">{hw.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {hw.classes.name} • Due: {hw.due_date ? dayjs(hw.due_date).format("MMM D") : "No due date"}
                      </p>
                    </div>
                  ))}
                  <Link to="/student/assignments">
                    <Button variant="outline" className="w-full">View All Assignments</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No pending homework</p>
              )}
            </CardContent>
          </Card>
        </div>


        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/schedule">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule
                </CardTitle>
                <CardDescription>View your class schedule</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/student/assignments">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Assignments
                </CardTitle>
                <CardDescription>Submit and track homework</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/tuition">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Tuition
                </CardTitle>
                <CardDescription>View payment details</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
