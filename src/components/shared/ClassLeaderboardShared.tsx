import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, Flag } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PointHistoryDialog } from "@/components/admin/PointHistoryDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/avatars";

interface ClassLeaderboardSharedProps {
  classId: string;
  currentStudentId?: string;
}

export function ClassLeaderboardShared({ classId, currentStudentId }: ClassLeaderboardSharedProps) {
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
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            CLASS RANK
          </CardTitle>
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
      <CardContent className="p-0">
        {leaderboard?.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No scores yet for this month</p>
        ) : (
          <div className="overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[80px_1fr_100px] gap-4 px-6 py-3 bg-muted/50 border-y font-semibold text-sm text-muted-foreground">
              <div>Rank</div>
              <div>Name</div>
              <div className="text-right">Score</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y">
              {leaderboard?.map((entry: any, index: number) => {
                const isCurrentStudent = currentStudentId && entry.student_id === currentStudentId;
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[80px_1fr_100px] gap-4 px-6 py-4 cursor-pointer transition-all hover:bg-accent/50 ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    } ${entry.rank <= 3 ? 'bg-primary/5' : ''} ${
                      isCurrentStudent ? 'ring-2 ring-primary/50 bg-primary/10' : ''
                    }`}
                    onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                  >
                    {/* Rank Column */}
                    <div className="flex items-center gap-2">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* Name Column */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className={`h-10 w-10 flex-shrink-0 ring-2 ${isCurrentStudent ? 'ring-primary' : 'ring-primary/20'}`}>
                        <AvatarImage src={getAvatarUrl(entry.students?.avatar_url) || undefined} alt={entry.students?.full_name} className="object-cover" />
                        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10">
                          {entry.students?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-base truncate">{entry.students?.full_name}</span>
                        {isCurrentStudent && (
                          <Flag className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Score Column */}
                    <div className="flex items-center justify-end">
                      <span className={`text-lg font-bold ${entry.rank <= 3 ? 'text-primary' : 'text-foreground'}`}>
                        {entry.total_points}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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
