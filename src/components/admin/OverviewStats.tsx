import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCog, BookOpen, Calendar, TrendingUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

  const statCards = [
    {
      title: "Total Students",
      value: stats?.students || 0,
      icon: Users,
      description: "Active student accounts",
      gradient: "from-blue-500 to-cyan-500",
      bgGlow: "bg-blue-500/20",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Total Teachers",
      value: stats?.teachers || 0,
      icon: UserCog,
      description: "Teaching staff members",
      gradient: "from-amber-500 to-orange-500",
      bgGlow: "bg-amber-500/20",
      trend: "+3%",
      trendUp: true,
    },
    {
      title: "Active Classes",
      value: stats?.classes || 0,
      icon: BookOpen,
      description: "Classes in curriculum",
      gradient: "from-emerald-500 to-teal-500",
      bgGlow: "bg-emerald-500/20",
      trend: "+5%",
      trendUp: true,
    },
    {
      title: "Upcoming Sessions",
      value: stats?.upcomingSessions || 0,
      icon: Calendar,
      description: "Scheduled sessions",
      gradient: "from-violet-500 to-purple-500",
      bgGlow: "bg-violet-500/20",
      trend: "This week",
      trendUp: null,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-10 w-10 bg-muted rounded-xl" />
                </div>
                <div className="h-8 w-16 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 border-border/50 bg-card/80 backdrop-blur-sm">
              {/* Gradient glow effect */}
              <div className={cn(
                "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                stat.bgGlow
              )} />
              
              {/* Decorative sparkle */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Sparkles className="h-4 w-4 text-muted-foreground/50" />
              </div>

              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight">
                        {stat.value.toLocaleString()}
                      </span>
                      {stat.trendUp !== null && (
                        <span className={cn(
                          "flex items-center text-xs font-medium",
                          stat.trendUp ? "text-emerald-500" : "text-rose-500"
                        )}>
                          <TrendingUp className={cn(
                            "h-3 w-3 mr-0.5",
                            !stat.trendUp && "rotate-180"
                          )} />
                          {stat.trend}
                        </span>
                      )}
                      {stat.trendUp === null && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {stat.trend}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shadow-lg",
                    "bg-gradient-to-br",
                    stat.gradient
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
                
                {/* Bottom gradient line */}
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  stat.gradient
                )} />
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
