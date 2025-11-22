import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, DollarSign, BookOpen, Users, Edit, FileText, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import TeacherScheduleCalendar from "@/components/teacher/TeacherScheduleCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TeacherProfileEdit } from "@/components/teacher/TeacherProfileEdit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassLeaderboardShared } from "@/components/shared/ClassLeaderboardShared";
import { ManualPointsDialog } from "@/components/shared/ManualPointsDialog";

export default function TeacherDashboard() {
  const queryClient = useQueryClient();
  const currentMonth = dayjs().format("YYYY-MM");
  const [showEditProfile, setShowEditProfile] = useState(false);

  const { data: teacherProfile } = useQuery({
    queryKey: ["teacher-dashboard-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      return teacher;
    },
  });

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

      if (!teacher) return [];

      const { data } = await supabase
        .from("sessions")
        .select(`
          class_id,
          classes!inner(id, name)
        `)
        .eq("teacher_id", teacher.id)
        .gte("date", dayjs().format("YYYY-MM-DD"));

      // Get unique classes
      const classMap = new Map();
      data?.forEach(s => {
        const classData = Array.isArray(s.classes) ? s.classes[0] : s.classes;
        if (classData && !classMap.has(classData.id)) {
          classMap.set(classData.id, classData);
        }
      });

      return Array.from(classMap.values());
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

  const { data: payrollData, isLoading } = useQuery({
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
      return { ...data?.payrollData?.[0], teacherId: teacher.id };
    },
  });

  // Real-time subscription for sessions changes
  useEffect(() => {
    if (!payrollData?.teacherId) return;

    const channel = supabase
      .channel('teacher-dashboard-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `teacher_id=eq.${payrollData.teacherId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["teacher-payroll", currentMonth] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [payrollData?.teacherId, currentMonth]);

  return (
    <Layout title="Dashboard">
      {/* Premium animated background orbs - different color scheme from auth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-40 right-40 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-40 left-40 w-[28rem] h-[28rem] bg-secondary/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-muted/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Teacher Profile Header */}
        {teacherProfile && (
          <Card className="glass-lg border-0 shadow-2xl backdrop-blur-xl hover:shadow-3xl transition-all duration-500 hover:scale-[1.01] animate-fade-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-secondary/10 pointer-events-none"></div>
            <CardHeader className="relative">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={teacherProfile.avatar_url || undefined} alt={teacherProfile.full_name} />
                    <AvatarFallback className="text-xl">
                      {teacherProfile.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h1 className="text-3xl font-bold">{teacherProfile.full_name}</h1>
                      <Badge variant={teacherProfile.is_active ? "default" : "secondary"} className={teacherProfile.is_active ? "bg-green-500" : ""}>
                        {teacherProfile.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1 text-muted-foreground text-sm">
                      {teacherProfile.email && <span>{teacherProfile.email}</span>}
                      {teacherProfile.phone && <span>{teacherProfile.phone}</span>}
                      <span>Hourly Rate: {(teacherProfile.hourly_rate_vnd || 0).toLocaleString()} ₫/hour</span>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setShowEditProfile(true)} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-lg border-0 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 group overflow-hidden animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="pb-2 relative">
              <CardDescription>Today's Sessions</CardDescription>
              <CardTitle className="text-3xl">{todaySessions?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {dayjs().format("MMM D, YYYY")}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-lg border-0 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 group overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="pb-2 relative">
              <CardDescription>Active Classes</CardDescription>
              <CardTitle className="text-3xl">{activeClasses?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Teaching this term</p>
            </CardContent>
          </Card>

          <Card className="glass-lg border-0 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 group overflow-hidden animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-muted/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="pb-2 relative">
              <CardDescription>Pending Grading</CardDescription>
              <CardTitle className="text-3xl">{pendingGrading || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Submissions to review</p>
            </CardContent>
          </Card>

          <Card className="glass-lg border-0 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 group overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="pb-2 relative">
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

          <Card className="glass-lg border-0 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 group overflow-hidden animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="pb-2 relative">
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

        <div className="grid gap-4 md:grid-cols-4">
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

          <Link to="/teacher/journal">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Journal
                </CardTitle>
                <CardDescription>Student journals</CardDescription>
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

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="leaderboards">Class Leaderboards</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Teaching Schedule</CardTitle>
                <CardDescription>Your upcoming and recent classes</CardDescription>
              </CardHeader>
              <CardContent>
                <TeacherScheduleCalendar />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboards" className="space-y-6">
            {activeClasses && activeClasses.length > 0 ? (
              activeClasses.map((classData: any) => (
                <Card key={classData.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5" />
                          {classData.name}
                        </CardTitle>
                        <CardDescription>Class Rankings & Points</CardDescription>
                      </div>
                      <ManualPointsDialog classId={classData.id} isAdmin={false} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ClassLeaderboardShared classId={classData.id} />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No active classes found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profile Dialog */}
      {teacherProfile && (
        <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Your Profile</DialogTitle>
            </DialogHeader>
            <TeacherProfileEdit teacherId={teacherProfile.id} />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
