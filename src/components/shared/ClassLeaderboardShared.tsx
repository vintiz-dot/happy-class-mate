import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PointHistoryDialog } from "@/components/admin/PointHistoryDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ClassLeaderboardSharedProps {
  classId: string;
}

export function ClassLeaderboardShared({ classId }: ClassLeaderboardSharedProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const previousLeaderboardRef = useRef<any[]>([]);

  // Set up realtime subscription for student_points changes
  useEffect(() => {
    const channel = supabase
      .channel('student-points-changes-shared')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_points',
          filter: `class_id=eq.${classId}`
        },
        (payload) => {
          console.log('Student points changed:', payload);
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ["class-leaderboard", classId] });
          queryClient.invalidateQueries({ queryKey: ["monthly-leader", classId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, queryClient]);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["class-leaderboard", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_points")
        .select(`
          *,
          students (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("class_id", classId)
        .eq("month", selectedMonth)
        .order("total_points", { ascending: false });

      if (error) throw error;

      // Implement dense ranking
      if (data && data.length > 0) {
        let currentRank = 1;
        let previousPoints = data[0].total_points;
        
        return data.map((entry, index) => {
          if (entry.total_points !== previousPoints) {
            currentRank = index + 1;
            previousPoints = entry.total_points;
          }
          return { ...entry, rank: currentRank };
        });
      }
      
      return data;
    },
  });

  // Track rank changes and show notifications
  useEffect(() => {
    if (!leaderboard || leaderboard.length === 0) return;

    const previousLeaderboard = previousLeaderboardRef.current;
    
    if (previousLeaderboard.length > 0) {
      // Create rank maps
      const previousRanks = new Map(
        previousLeaderboard.map((entry: any, index: number) => [entry.student_id, index + 1])
      );
      
      const currentRanks = new Map(
        leaderboard.map((entry: any, index: number) => [entry.student_id, index + 1])
      );

      // Check for rank changes
      leaderboard.forEach((entry: any, index: number) => {
        const currentRank = index + 1;
        const previousRank = previousRanks.get(entry.student_id);
        
        if (previousRank && previousRank !== currentRank) {
          const rankChange = previousRank - currentRank;
          const studentName = entry.students?.full_name || 'A student';
          
          if (rankChange > 0) {
            // Rank improved (moved up)
            toast({
              title: "🎉 Rank Improved!",
              description: `${studentName} moved up ${rankChange} ${rankChange === 1 ? 'position' : 'positions'} to #${currentRank}`,
              duration: 5000,
            });
          } else {
            // Rank dropped (moved down)
            toast({
              title: "Rank Changed",
              description: `${studentName} moved to #${currentRank}`,
              duration: 4000,
            });
          }
        }
      });
    }

    // Update reference for next comparison
    previousLeaderboardRef.current = leaderboard;
  }, [leaderboard, toast]);

  const { data: monthlyLeader } = useQuery({
    queryKey: ["monthly-leader", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_leaders")
        .select(`
          *,
          students (
            id,
            full_name
          )
        `)
        .eq("class_id", classId)
        .eq("month", selectedMonth)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-700" />;
      default:
        return <span className="text-muted-foreground font-semibold">#{rank}</span>;
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading leaderboard...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Class Leaderboard
            </CardTitle>
            <CardDescription>Raw point totals • Dense ranking • No caps</CardDescription>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const month = date.toISOString().slice(0, 7);
                return (
                  <SelectItem key={month} value={month}>
                    {date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {monthlyLeader && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">🏆 Top Student This Month</p>
            <p className="text-lg font-bold">{monthlyLeader.students?.full_name}</p>
            <p className="text-sm text-primary">{monthlyLeader.total_points} points</p>
          </div>
        )}

        {leaderboard?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No scores yet for this month</p>
        ) : (
          <div className="space-y-3">
            {leaderboard?.map((entry: any) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 border-2 rounded-xl hover:bg-accent/50 cursor-pointer transition-all hover:shadow-md"
                onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 flex-shrink-0 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <Avatar className="h-12 w-12 flex-shrink-0 border-2">
                    <AvatarImage src={entry.students?.avatar_url || undefined} alt={entry.students?.full_name} />
                    <AvatarFallback className="text-sm font-semibold">
                      {entry.students?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base truncate">{entry.students?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      HW: {entry.homework_points} • Part: {entry.participation_points}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant={entry.rank <= 3 ? "default" : "secondary"} className="text-base px-4 py-2">
                    {entry.total_points}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {selectedStudent && (
        <PointHistoryDialog
          studentId={selectedStudent.id}
          classId={classId}
          month={selectedMonth}
          studentName={selectedStudent.name}
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
        />
      )}
    </Card>
  );
}
