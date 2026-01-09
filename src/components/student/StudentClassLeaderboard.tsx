import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getRandomAvatarUrl } from "@/lib/avatars";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudentAnalyticsModal } from "@/components/student/StudentAnalyticsModal";

interface StudentClassLeaderboardProps {
  classId: string;
  className?: string;
  currentStudentId?: string;
}

export function StudentClassLeaderboard({ classId, className, currentStudentId }: StudentClassLeaderboardProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [analyticsStudent, setAnalyticsStudent] = useState<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    totalPoints: number;
    homeworkPoints: number;
    participationPoints: number;
    readingTheoryPoints: number;
    rank: number;
  } | null>(null);
  const [analyticsMonth, setAnalyticsMonth] = useState<string>(selectedMonth);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["student-class-leaderboard", classId, selectedMonth],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("class_id", classId)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (enrollError) throw enrollError;

      const { data: points, error: pointsError } = await supabase
        .from("student_points")
        .select("*")
        .eq("class_id", classId)
        .eq("month", selectedMonth);

      if (pointsError) throw pointsError;

      const pointsMap = new Map(points?.map(p => [p.student_id, p]) || []);

      const combined = enrollments?.map(enrollment => {
        const studentPoints = pointsMap.get(enrollment.student_id);
        return {
          id: studentPoints?.id || `temp-${enrollment.student_id}`,
          student_id: enrollment.student_id,
          class_id: classId,
          month: selectedMonth,
          homework_points: studentPoints?.homework_points || 0,
          participation_points: studentPoints?.participation_points || 0,
          reading_theory_points: studentPoints?.reading_theory_points || 0,
          total_points: studentPoints?.total_points || 0,
          students: enrollment.students,
        };
      }) || [];

      combined.sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        const nameA = a.students?.full_name || '';
        const nameB = b.students?.full_name || '';
        return nameA.localeCompare(nameB);
      });

      if (combined.length > 0) {
        let currentRank = 1;
        let previousPoints = combined[0].total_points;
        
        return combined.map((entry, index) => {
          if (entry.total_points !== previousPoints) {
            currentRank = index + 1;
            previousPoints = entry.total_points;
          }
          return { ...entry, rank: currentRank };
        });
      }
      
      return combined;
    },
  });

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-xl">🥇</span>;
      case 2:
        return <span className="text-xl">🥈</span>;
      case 3:
        return <span className="text-xl">🥉</span>;
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-card to-card/80 border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-warning/20 to-accent/20 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h3 className="font-bold text-foreground">{className || 'Class Ranking'}</h3>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 }, (_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() - i);
              const month = date.toISOString().slice(0, 7);
              return (
                <SelectItem key={month} value={month}>
                  {date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Leaderboard List */}
      {leaderboard?.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No scores yet for this month
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y divide-border/30">
            {leaderboard?.map((entry: any, index: number) => {
              const isCurrentStudent = currentStudentId && entry.student_id === currentStudentId;
              
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`
                    flex items-center gap-3 p-3 cursor-pointer transition-colors
                    ${isCurrentStudent 
                      ? 'bg-primary/10 border-l-4 border-primary' 
                      : 'hover:bg-muted/30 border-l-4 border-transparent'
                    }
                  `}
                  onClick={() => {
                    setAnalyticsStudent({
                      id: entry.student_id,
                      name: entry.students?.full_name,
                      avatarUrl: entry.students?.avatar_url,
                      totalPoints: entry.total_points,
                      homeworkPoints: entry.homework_points || 0,
                      participationPoints: entry.participation_points || 0,
                      readingTheoryPoints: entry.reading_theory_points || 0,
                      rank: entry.rank,
                    });
                    setAnalyticsMonth(selectedMonth);
                  }}
                >
                  {/* Rank */}
                  <div className="w-10 flex-shrink-0 text-center">
                    {getRankDisplay(entry.rank)}
                  </div>

                  {/* Avatar */}
                  <Avatar className={`h-10 w-10 flex-shrink-0 border-2 ${
                    entry.rank === 1 ? 'border-yellow-400' : 
                    entry.rank === 2 ? 'border-gray-400' : 
                    entry.rank === 3 ? 'border-amber-600' : 
                    isCurrentStudent ? 'border-primary' : 'border-transparent'
                  }`}>
                    <AvatarImage 
                      src={getAvatarUrl(entry.students?.avatar_url) || getRandomAvatarUrl(entry.student_id)} 
                      alt={entry.students?.full_name}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      <img 
                        src={getRandomAvatarUrl(entry.student_id)} 
                        alt="avatar" 
                        className="w-full h-full object-cover"
                      />
                    </AvatarFallback>
                  </Avatar>

                  {/* Name - NO truncation */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground whitespace-normal break-words">
                      {entry.students?.full_name}
                      {isCurrentStudent && (
                        <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                          You
                        </Badge>
                      )}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="flex-shrink-0 text-right">
                    <span className="font-bold text-lg text-foreground">{entry.total_points}</span>
                    <span className="text-xs text-muted-foreground ml-1">XP</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Analytics Modal */}
      <StudentAnalyticsModal
        open={!!analyticsStudent}
        onOpenChange={(open) => !open && setAnalyticsStudent(null)}
        student={analyticsStudent}
        classId={classId}
        selectedMonth={analyticsMonth}
      />
    </div>
  );
}