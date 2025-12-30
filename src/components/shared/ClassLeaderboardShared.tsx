import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Flag, Users, X, CheckSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PointHistoryDialog } from "@/components/admin/PointHistoryDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getRandomAvatarUrl } from "@/lib/avatars";
import { StudentActionPopover } from "@/components/shared/StudentActionPopover";
import { BulkPointsDialog } from "@/components/shared/BulkPointsDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface ClassLeaderboardSharedProps {
  classId: string;
  currentStudentId?: string;
  canManagePoints?: boolean;
}

interface SelectedStudent {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export function ClassLeaderboardShared({ classId, currentStudentId, canManagePoints = true }: ClassLeaderboardSharedProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Map<string, SelectedStudent>>(new Map());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
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
      const previousRanks = new Map(
        previousLeaderboard.map((entry: any, index: number) => [entry.student_id, index + 1])
      );

      leaderboard.forEach((entry: any, index: number) => {
        const currentRank = index + 1;
        const previousRank = previousRanks.get(entry.student_id);
        
        if (previousRank && previousRank !== currentRank) {
          const rankChange = previousRank - currentRank;
          const studentName = entry.students?.full_name || 'A student';
          
          if (rankChange > 0) {
            toast({
              title: "🎉 Rank Improved!",
              description: `${studentName} moved up ${rankChange} ${rankChange === 1 ? 'position' : 'positions'} to #${currentRank}`,
              duration: 5000,
            });
          } else {
            toast({
              title: "Rank Changed",
              description: `${studentName} moved to #${currentRank}`,
              duration: 4000,
            });
          }
        }
      });
    }

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

  const toggleStudentSelection = (student: SelectedStudent, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedStudents((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(student.id)) {
        newMap.delete(student.id);
      } else {
        newMap.set(student.id, student);
      }
      return newMap;
    });
  };

  const selectAll = () => {
    if (!leaderboard) return;
    const allStudents = new Map<string, SelectedStudent>();
    leaderboard.forEach((entry: any) => {
      allStudents.set(entry.student_id, {
        id: entry.student_id,
        name: entry.students?.full_name,
        avatarUrl: entry.students?.avatar_url,
      });
    });
    setSelectedStudents(allStudents);
  };

  const clearSelection = () => {
    setSelectedStudents(new Map());
  };

  const handleBulkSuccess = () => {
    clearSelection();
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading leaderboard...</p>;
  }

  const topThree = leaderboard?.slice(0, 3) || [];
  const restOfList = leaderboard?.slice(3) || [];
  const hasSelection = selectedStudents.size > 0;
  const allSelected = leaderboard && leaderboard.length > 0 && selectedStudents.size === leaderboard.length;

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
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto flex-wrap">
          {canManagePoints && leaderboard && leaderboard.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={allSelected ? clearSelection : selectAll}
              className="glass-panel border-leaderboard-glassBorder text-white hover:bg-white/20"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          )}
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
            {topThree.map((entry: any) => {
              const isCurrentStudent = currentStudentId && entry.student_id === currentStudentId;
              const isSelected = selectedStudents.has(entry.student_id);
              const student: SelectedStudent = {
                id: entry.student_id,
                name: entry.students?.full_name,
                avatarUrl: entry.students?.avatar_url,
              };

              return (
                <div
                  key={entry.id}
                  className={`flex flex-col items-center floating-element relative ${
                    isCurrentStudent ? 'ring-2 md:ring-4 ring-yellow-300 rounded-xl md:rounded-2xl p-2 md:p-4 bg-white/10' : ''
                  } ${isSelected && !isCurrentStudent ? 'ring-2 md:ring-4 ring-primary rounded-xl md:rounded-2xl p-2 md:p-4 bg-primary/20' : ''}`}
                >
                  {/* Checkbox for selection */}
                  {canManagePoints && (
                    <div
                      className="absolute top-0 right-0 md:top-2 md:right-2 z-20"
                      onClick={(e) => toggleStudentSelection(student, e)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="h-5 w-5 md:h-6 md:w-6 border-2 border-white bg-white/20 data-[state=checked]:bg-primary"
                      />
                    </div>
                  )}

                  <StudentActionPopover
                    studentId={entry.student_id}
                    studentName={entry.students?.full_name}
                    classId={classId}
                    onViewHistory={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                    canManagePoints={canManagePoints}
                  >
                    <div className="cursor-pointer">
                      <div className="relative mb-2 md:mb-4">
                        <Avatar className={`h-16 w-16 md:h-32 md:w-32 border-4 md:border-8 ${isCurrentStudent ? 'border-yellow-300' : 'border-transparent'} shadow-2xl bg-gradient-to-br from-leaderboard-gradientStart to-leaderboard-gradientEnd p-0.5 md:p-1`}>
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
                      <div className="flex items-center gap-1 md:gap-2 justify-center mb-0.5 md:mb-1">
                        <p className="text-leaderboard-text font-bold text-xs md:text-lg drop-shadow-md text-center line-clamp-2 px-1">
                          {entry.students?.full_name}
                        </p>
                        {isCurrentStudent && (
                          <Flag className="h-3 w-3 md:h-5 md:w-5 text-yellow-300 fill-yellow-300 drop-shadow-lg flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-leaderboard-text text-xl md:text-4xl font-black drop-shadow-lg">
                        {entry.total_points}
                      </p>
                    </div>
                  </StudentActionPopover>
                </div>
              );
            })}
          </div>

          {/* Ranks 4+ List */}
          {restOfList.length > 0 && (
            <div className="relative z-10 glass-panel rounded-xl md:rounded-2xl shadow-xl overflow-hidden">
              <div className="grid grid-cols-[30px_40px_1fr_50px] md:grid-cols-[40px_80px_1fr_100px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4 bg-white/10 border-b-2 border-leaderboard-glassBorder/20 font-bold text-xs md:text-sm text-leaderboard-text">
                <div></div>
                <div>RANK</div>
                <div>NAME</div>
                <div className="text-right">SCORE</div>
              </div>
              <div className="divide-y divide-leaderboard-glassBorder/20">
                {restOfList.map((entry: any) => {
                  const isCurrentStudent = currentStudentId && entry.student_id === currentStudentId;
                  const isSelected = selectedStudents.has(entry.student_id);
                  const student: SelectedStudent = {
                    id: entry.student_id,
                    name: entry.students?.full_name,
                    avatarUrl: entry.students?.avatar_url,
                  };

                  return (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-[30px_40px_1fr_50px] md:grid-cols-[40px_80px_1fr_100px] gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-4 transition-all hover:bg-white/10 ${
                        isCurrentStudent ? 'bg-yellow-300/20 ring-2 ring-yellow-300' : ''
                      } ${isSelected && !isCurrentStudent ? 'bg-primary/20' : ''}`}
                    >
                      <div className="flex items-center" onClick={(e) => canManagePoints && toggleStudentSelection(student, e)}>
                        {canManagePoints && (
                          <Checkbox
                            checked={isSelected}
                            className="h-4 w-4 md:h-5 md:w-5 border-2 border-white/50 bg-white/20 data-[state=checked]:bg-primary cursor-pointer"
                          />
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-leaderboard-text font-bold text-sm md:text-lg">#{entry.rank}</span>
                      </div>
                      <StudentActionPopover
                        studentId={entry.student_id}
                        studentName={entry.students?.full_name}
                        classId={classId}
                        onViewHistory={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                        canManagePoints={canManagePoints}
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 cursor-pointer">
                          <Avatar className={`h-8 w-8 md:h-10 md:w-10 flex-shrink-0 border-2 ${isCurrentStudent ? 'border-yellow-300' : 'border-transparent'} bg-gradient-to-br from-leaderboard-gradientStart to-leaderboard-gradientEnd p-0.5`}>
                            <AvatarImage src={getAvatarUrl(entry.students?.avatar_url) || getRandomAvatarUrl(entry.student_id)} alt={entry.students?.full_name} className="object-cover rounded-full" />
                            <AvatarFallback className="text-xs font-semibold rounded-full">
                              <img src={getRandomAvatarUrl(entry.student_id)} alt="avatar" className="w-full h-full object-cover rounded-full" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-1">
                            <span className="font-semibold text-leaderboard-text truncate text-sm md:text-base">{entry.students?.full_name}</span>
                            {isCurrentStudent && (
                              <Flag className="h-3 w-3 md:h-4 md:w-4 text-yellow-300 fill-yellow-300 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </StudentActionPopover>
                      <div className="flex items-center justify-end">
                        <span className="text-sm md:text-lg font-bold text-leaderboard-text">{entry.total_points}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Action Bar for Bulk Actions */}
      {canManagePoints && hasSelection && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-panel border border-leaderboard-glassBorder rounded-full px-4 py-3 flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 text-white">
            <Users className="h-4 w-4" />
            <span className="font-semibold">{selectedStudents.size} selected</span>
          </div>
          <div className="w-px h-6 bg-white/30" />
          <Button
            size="sm"
            onClick={() => setShowBulkDialog(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Trophy className="h-4 w-4 mr-1" />
            Add Points
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            className="text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedStudent && (
        <PointHistoryDialog
          studentId={selectedStudent.id}
          classId={classId}
          month={selectedMonth}
          studentName={selectedStudent.name}
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
          canDelete={canManagePoints}
        />
      )}

      {canManagePoints && (
        <BulkPointsDialog
          classId={classId}
          selectedStudents={Array.from(selectedStudents.values())}
          open={showBulkDialog}
          onOpenChange={setShowBulkDialog}
          onSuccess={handleBulkSuccess}
        />
      )}
    </div>
  );
}
