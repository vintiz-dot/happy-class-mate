import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PointHistoryDialog } from "./PointHistoryDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ManualPointsDialog } from "@/components/shared/ManualPointsDialog";
import { getAvatarUrl } from "@/lib/avatars";

interface ClassLeaderboardProps {
  classId: string;
  showAddPoints?: boolean;
}

export function ClassLeaderboard({ classId, showAddPoints = true }: ClassLeaderboardProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const previousLeaderboardRef = useRef<any[]>([]);

  // Set up realtime subscription for student_points changes
  useEffect(() => {
    const channel = supabase
      .channel('student-points-changes')
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

  const topThree = leaderboard?.slice(0, 3) || [];
  const restOfList = leaderboard?.slice(3, 10) || [];

  return (
    <div className="bg-leaderboard-pink rounded-3xl p-8 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-5xl font-black text-leaderboard-text drop-shadow-lg tracking-tight">
          CLASS RANK
        </h1>
        <div className="flex items-center gap-3">
          {showAddPoints && <ManualPointsDialog classId={classId} isAdmin={true} />}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-white/95 border-none shadow-lg">
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
      </div>

      {leaderboard?.length === 0 ? (
        <p className="text-leaderboard-text text-center py-12 text-xl">No scores yet for this month</p>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            {topThree.map((entry: any) => (
              <div
                key={entry.id}
                className="flex flex-col items-center cursor-pointer transform transition-transform hover:scale-105"
                onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
              >
                <div className="relative mb-4">
                  <Avatar className="h-32 w-32 border-8 border-white shadow-2xl">
                    <AvatarImage 
                      src={getAvatarUrl(entry.students?.avatar_url) || undefined} 
                      alt={entry.students?.full_name} 
                      className="object-cover" 
                    />
                    <AvatarFallback className="text-3xl font-black bg-gradient-to-br from-primary to-primary/70 text-white">
                      {entry.students?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full h-12 w-12 flex items-center justify-center shadow-xl border-4 border-leaderboard-pink">
                    {getRankIcon(entry.rank)}
                  </div>
                </div>
                <p className="text-leaderboard-text font-bold text-lg mb-1 drop-shadow-md text-center">
                  {entry.students?.full_name}
                </p>
                <p className="text-leaderboard-text text-4xl font-black drop-shadow-lg">
                  {entry.total_points}
                </p>
              </div>
            ))}
          </div>

          {/* Ranks 4-10 List */}
          {restOfList.length > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
              <div className="grid grid-cols-[80px_1fr_100px] gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200 font-bold text-sm text-gray-700">
                <div>RANK</div>
                <div>NAME</div>
                <div className="text-right">SCORE</div>
              </div>
              <div className="divide-y divide-gray-200">
                {restOfList.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[80px_1fr_100px] gap-4 px-6 py-4 cursor-pointer transition-all hover:bg-gray-50"
                    onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                  >
                    <div className="flex items-center">
                      <span className="text-gray-700 font-bold text-lg">#{entry.rank}</span>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0 border-2 border-gray-200">
                        <AvatarImage src={getAvatarUrl(entry.students?.avatar_url) || undefined} alt={entry.students?.full_name} className="object-cover" />
                        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10">
                          {entry.students?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-gray-800 truncate">{entry.students?.full_name}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-lg font-bold text-gray-900">{entry.total_points}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

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
    </div>
  );
}
