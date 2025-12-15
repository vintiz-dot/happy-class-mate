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
import { getAvatarUrl, getRandomAvatarUrl } from "@/lib/avatars";

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
    <div className="relative bg-leaderboard-bg rounded-3xl p-4 md:p-8 shadow-2xl overflow-hidden min-h-[400px] md:min-h-[600px]">
      {/* Animated Starfield Background */}
      <div className="starfield">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="star"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.3,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${Math.random() * 3 + 3}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-5xl font-black text-leaderboard-text drop-shadow-lg tracking-tight">
          CLASS RANK
        </h1>
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
          {showAddPoints && <ManualPointsDialog classId={classId} isAdmin={true} />}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full md:w-[180px] glass-panel border-leaderboard-glassBorder shadow-lg text-white">
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
        <p className="relative z-10 text-leaderboard-text text-center py-12 text-xl">No scores yet for this month</p>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="relative z-10 grid grid-cols-3 gap-2 md:gap-6 mb-6 md:mb-8">
            {topThree.map((entry: any) => (
              <div
                key={entry.id}
                className="flex flex-col items-center cursor-pointer floating-element"
                onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
              >
                <div className="relative mb-2 md:mb-4">
                  <Avatar className="h-16 w-16 md:h-32 md:w-32 border-4 md:border-8 border-transparent shadow-2xl bg-gradient-to-br from-leaderboard-gradientStart to-leaderboard-gradientEnd p-0.5 md:p-1">
                    <AvatarImage 
                      src={getAvatarUrl(entry.students?.avatar_url) || getRandomAvatarUrl(entry.student_id)} 
                      alt={entry.students?.full_name} 
                      className="object-cover rounded-full" 
                    />
                    <AvatarFallback className="text-lg md:text-3xl font-black rounded-full">
                      <img src={getRandomAvatarUrl(entry.student_id)} alt="avatar" className="w-full h-full object-cover rounded-full" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 md:-bottom-2 left-1/2 -translate-x-1/2 glass-panel rounded-full h-6 w-6 md:h-12 md:w-12 flex items-center justify-center shadow-xl border md:border-2 border-leaderboard-glassBorder floating-element">
                    <span className="scale-75 md:scale-100">{getRankIcon(entry.rank)}</span>
                  </div>
                </div>
                <p className="text-leaderboard-text font-bold text-xs md:text-lg mb-0.5 md:mb-1 drop-shadow-md text-center line-clamp-2 px-1">
                  {entry.students?.full_name}
                </p>
                <p className="text-leaderboard-text text-xl md:text-4xl font-black drop-shadow-lg">
                  {entry.total_points}
                </p>
              </div>
            ))}
          </div>

          {/* Ranks 4-10 List */}
          {restOfList.length > 0 && (
            <div className="relative z-10 glass-panel rounded-xl md:rounded-2xl shadow-xl overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_50px] md:grid-cols-[80px_1fr_100px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4 bg-white/10 border-b-2 border-leaderboard-glassBorder/20 font-bold text-xs md:text-sm text-leaderboard-text">
                <div>RANK</div>
                <div>NAME</div>
                <div className="text-right">SCORE</div>
              </div>
              <div className="divide-y divide-leaderboard-glassBorder/20">
                {restOfList.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[40px_1fr_50px] md:grid-cols-[80px_1fr_100px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4 cursor-pointer transition-all hover:bg-white/10"
                    onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                  >
                    <div className="flex items-center">
                      <span className="text-leaderboard-text font-bold text-sm md:text-lg">#{entry.rank}</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0 border-2 border-transparent bg-gradient-to-br from-leaderboard-gradientStart to-leaderboard-gradientEnd p-0.5">
                        <AvatarImage src={getAvatarUrl(entry.students?.avatar_url) || getRandomAvatarUrl(entry.student_id)} alt={entry.students?.full_name} className="object-cover rounded-full" />
                        <AvatarFallback className="text-xs font-semibold rounded-full">
                          <img src={getRandomAvatarUrl(entry.student_id)} alt="avatar" className="w-full h-full object-cover rounded-full" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-leaderboard-text truncate text-sm md:text-base">{entry.students?.full_name}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="text-sm md:text-lg font-bold text-leaderboard-text">{entry.total_points}</span>
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
