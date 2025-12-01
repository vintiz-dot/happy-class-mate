import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monthKey, dayjs } from "@/lib/date";
import CalendarMonth from "@/components/calendar/CalendarMonth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassLeaderboardShared } from "@/components/shared/ClassLeaderboardShared";
import { ManualPointsDialog } from "@/components/shared/ManualPointsDialog";

export default function TeacherClassDetail() {
  const { id } = useParams<{ id: string }>();
  const [month, setMonth] = useState(monthKey());
  const queryClient = useQueryClient();

  // Real-time subscription for enrollment changes
  useEffect(() => {
    const channel = supabase
      .channel(`teacher-class-enrollments-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollments',
          filter: `class_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["teacher-class-roster", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ["teacher-class", id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) throw new Error("Not a teacher");

      const { data: sessions } = await supabase
        .from("sessions")
        .select("id")
        .eq("class_id", id)
        .eq("teacher_id", teacher.id)
        .limit(1);

      if (!sessions || sessions.length === 0) {
        return null;
      }

      const { data: classInfo, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("id", id)
        .single();

      if (error) throw error;
      return classInfo;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["teacher-class-sessions", id, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          notes,
          class_id,
          classes!inner(name)
        `)
        .eq("class_id", id)
        .gte("date", `${month}-01`)
        .lte("date", `${month}-31`)
        .order("date", { ascending: true });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        class_name: s.classes.name,
        status: s.status,
        notes: s.notes,
      }));
    },
    enabled: !!classData,
  });

  const { data: roster = [] } = useQuery({
    queryKey: ["teacher-class-roster", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students!inner(id, full_name, is_active)
        `)
        .eq("class_id", id)
        .is("end_date", null);

      if (error) throw error;

      return (data || [])
        .map((e: any) => e.students)
        .filter((s: any) => s.is_active);
    },
    enabled: !!classData,
  });

  if (classLoading) {
    return <Layout title="Loading...">Loading...</Layout>;
  }

  if (!classData) {
    return (
      <Layout title="No Access">
        <Card>
          <CardHeader>
            <CardTitle>No Access to This Class</CardTitle>
            <CardDescription>
              You are not assigned to teach this class. If you believe this is an error, please contact an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button asChild variant="outline">
                <Link to="/classes">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  View My Classes
                </Link>
              </Button>
              <Button variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Contact Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const prevMonth = () => {
    setMonth(dayjs.tz(`${month}-01`).subtract(1, "month").format("YYYY-MM"));
  };

  const nextMonth = () => {
    setMonth(dayjs.tz(`${month}-01`).add(1, "month").format("YYYY-MM"));
  };

  const goToday = () => {
    setMonth(monthKey());
  };

  return (
    <Layout title={classData.name}>
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[200px] text-center">
              {dayjs.tz(`${month}-01`).format("MMMM YYYY")}
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToday} className="ml-2">
              Today
            </Button>
          </div>

          <CalendarMonth month={month} events={events} />
        </TabsContent>

        <TabsContent value="roster">
          <Card>
            <CardHeader>
              <CardTitle>Class Roster</CardTitle>
              <CardDescription>
                {roster.length} {roster.length === 1 ? "student" : "students"} enrolled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {roster.map((student: any) => (
                  <div key={student.id} className="border rounded-lg px-3 py-2">
                    {student.full_name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <div className="flex justify-end">
            <ManualPointsDialog classId={id!} isAdmin={false} />
          </div>
          <ClassLeaderboardShared classId={id!} />
        </TabsContent>

        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <CardTitle>Class Materials</CardTitle>
              <CardDescription>
                Assignments and resources for this class
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">
                No materials yet. Go to <Link to="/teacher/assignments" className="text-primary hover:underline">Assignments</Link> to create materials for this class.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
