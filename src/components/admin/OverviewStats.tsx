import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, BookOpen, Calendar } from "lucide-react";

export function OverviewStats() {
  const queryClient = useQueryClient();

  // Real-time subscriptions for live stats updates
  useEffect(() => {
    const studentsChannel = supabase
      .channel('overview-students-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["overview-stats"] });
        }
      )
      .subscribe();

    const enrollmentsChannel = supabase
      .channel('overview-enrollments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["overview-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(enrollmentsChannel);
    };
  }, [queryClient]);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: async () => {
      const [studentsRes, teachersRes, classesRes, sessionsRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "Scheduled"),
      ]);

      return {
        students: studentsRes.count || 0,
        teachers: teachersRes.count || 0,
        classes: classesRes.count || 0,
        upcomingSessions: sessionsRes.count || 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Students",
      value: stats?.students || 0,
      icon: Users,
      description: "Active student accounts",
    },
    {
      title: "Total Teachers",
      value: stats?.teachers || 0,
      icon: UserCog,
      description: "Teaching staff members",
    },
    {
      title: "Active Classes",
      value: stats?.classes || 0,
      icon: BookOpen,
      description: "Classes in curriculum",
    },
    {
      title: "Upcoming Sessions",
      value: stats?.upcomingSessions || 0,
      icon: Calendar,
      description: "Scheduled sessions",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}