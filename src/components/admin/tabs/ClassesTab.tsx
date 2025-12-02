import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ClassForm } from "@/components/admin/ClassForm";
import { Users, Clock } from "lucide-react";

const ClassesTab = () => {
  const queryClient = useQueryClient();

  // Real-time subscription for enrollment changes
  useEffect(() => {
    const channel = supabase
      .channel('classes-enrollments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["classes"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (classesError) throw classesError;

      // Fetch only active enrollments (end_date IS NULL)
      const { data: enrollmentCounts, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("class_id")
        .is("end_date", null);

      if (enrollmentError) throw enrollmentError;

      // Count active enrollments per class
      const countByClass = (enrollmentCounts || []).reduce((acc, e) => {
        acc[e.class_id] = (acc[e.class_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Merge counts into classes
      return (classesData || []).map(cls => ({
        ...cls,
        activeEnrollmentCount: countByClass[cls.id] || 0
      }));
    },
  });

  return (
    <div className="space-y-8">
      <ClassForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["classes"] })} />
      
      <div>
        <h2 className="text-2xl font-bold mb-4">Active Classes</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading classes...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes?.map((cls) => (
              <Link key={cls.id} to={`/admin/classes/${cls.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle>{cls.name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {cls.activeEnrollmentCount} students
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {cls.default_session_length_minutes}min
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Rate: {cls.session_rate_vnd?.toLocaleString('vi-VN')} ₫/session
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassesTab;
