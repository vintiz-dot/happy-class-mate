import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Sparkles, Star, Zap, Crown } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  avatar_url: string | null;
  participation_points: number;
  homework_points: number;
  total_points: number;
  is_current_user: boolean;
  rank: number;
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-class-leaderboard", classId, selectedMonth],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("class-leaderboard", {
        body: { classId, month: selectedMonth },
      });

      if (response.error) throw response.error;
      return response.data as { leaderboard: LeaderboardEntry[]; currentStudentId: string | null };
    },
  });

  const leaderboard = data?.leaderboard || [];
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return null;
    }
  };

  const getRankGradient = (rank: number) => {
    switch (rank) {
      case 1: return "from-yellow-400/30 via-amber-300/20 to-orange-400/30";
      case 2: return "from-slate-300/30 via-gray-200/20 to-slate-400/30";
      case 3: return "from-amber-600/30 via-orange-400/20 to-amber-700/30";
      default: return "from-card to-card";
    }
  };

  const getRankBorder = (rank: number) => {
    switch (rank) {
      case 1: return "border-yellow-400/60 shadow-yellow-400/20";
      case 2: return "border-slate-400/60 shadow-slate-400/20";
      case 3: return "border-amber-600/60 shadow-amber-600/20";
      default: return "border-border/50";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-10 w-10 text-primary" />
        </motion.div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading champions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Unable to load leaderboard</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-card via-card to-primary/5 border border-border/50 shadow-xl">
      {/* Animated background sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full"
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              opacity: 0 
            }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{ 
              duration: 2 + Math.random() * 2, 
              repeat: Infinity, 
              delay: Math.random() * 2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between p-4 bg-gradient-to-r from-warning/20 via-accent/10 to-primary/20 border-b border-border/30">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Trophy className="h-6 w-6 text-warning drop-shadow-lg" />
          </motion.div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{className || 'Champions'}</h3>
            <p className="text-xs text-muted-foreground">Who's on top?</p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[130px] h-9 text-xs bg-background/60 backdrop-blur-sm border-border/50 rounded-xl">
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

      {leaderboard.length === 0 ? (
        <div className="p-12 text-center">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          </motion.div>
          <p className="text-muted-foreground font-medium">No scores yet!</p>
          <p className="text-sm text-muted-foreground/70">Be the first to earn XP 🚀</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div className="flex justify-center items-end gap-2 pb-4">
              {/* Reorder for podium: 2nd, 1st, 3rd */}
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry, displayIndex) => {
                if (!entry) return null;
                const actualRank = entry.rank;
                const isFirst = actualRank === 1;
                const isCurrentUser = entry.is_current_user;
                
                return (
                  <motion.div
                    key={entry.student_id}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: displayIndex * 0.1, type: "spring", stiffness: 200 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    onClick={() => {
                      setAnalyticsStudent({
                        id: entry.student_id,
                        name: entry.student_name,
                        avatarUrl: entry.avatar_url,
                        totalPoints: entry.total_points,
                        homeworkPoints: entry.homework_points,
                        participationPoints: entry.participation_points,
                        readingTheoryPoints: 0,
                        rank: entry.rank,
                      });
                      setAnalyticsMonth(selectedMonth);
                    }}
                    className={`
                      relative flex flex-col items-center cursor-pointer
                      ${isFirst ? 'order-2 -mt-4' : displayIndex === 0 ? 'order-1' : 'order-3'}
                    `}
                  >
                    {/* Crown for 1st place */}
                    {isFirst && (
                      <motion.div
                        animate={{ y: [0, -3, 0], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-6 z-10"
                      >
                        <Crown className="h-6 w-6 text-yellow-400 drop-shadow-lg" />
                      </motion.div>
                    )}
                    
                    {/* Card */}
                    <div className={`
                      relative p-3 rounded-2xl border-2 bg-gradient-to-br ${getRankGradient(actualRank)} ${getRankBorder(actualRank)}
                      backdrop-blur-sm shadow-lg transition-shadow hover:shadow-xl
                      ${isFirst ? 'w-28' : 'w-24'}
                    `}>
                      {/* Glow effect for current user */}
                      {isCurrentUser && (
                        <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-pulse" />
                      )}
                      
                      {/* Avatar */}
                      <div className="relative flex justify-center mb-2">
                        <Avatar className={`${isFirst ? 'h-16 w-16' : 'h-12 w-12'} border-2 border-white/50 shadow-md`}>
                          <AvatarImage 
                            src={getAvatarUrl(entry.avatar_url) || getRandomAvatarUrl(entry.student_id)} 
                            alt={entry.student_name}
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
                        
                        {/* Rank badge */}
                        <span className="absolute -bottom-1 text-2xl drop-shadow-lg">
                          {getRankEmoji(actualRank)}
                        </span>
                      </div>
                      
                      {/* Name */}
                      <p className={`text-center font-bold text-foreground leading-tight ${isFirst ? 'text-sm' : 'text-xs'} line-clamp-2`}>
                        {entry.student_name}
                      </p>
                      
                      {/* You badge */}
                      {isCurrentUser && (
                        <div className="flex justify-center mt-1">
                          <Badge className="text-[9px] px-1.5 py-0 bg-primary text-primary-foreground shadow-md">
                            ⭐ You
                          </Badge>
                        </div>
                      )}
                      
                      {/* Points */}
                      <div className="mt-2 text-center">
                        <span className={`font-extrabold ${isFirst ? 'text-xl' : 'text-lg'} text-foreground`}>
                          {entry.total_points}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">XP</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-2">
                <AnimatePresence>
                  {rest.map((entry, index) => {
                    const isCurrentUser = entry.is_current_user;
                    
                    return (
                      <motion.div
                        key={entry.student_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        onClick={() => {
                          setAnalyticsStudent({
                            id: entry.student_id,
                            name: entry.student_name,
                            avatarUrl: entry.avatar_url,
                            totalPoints: entry.total_points,
                            homeworkPoints: entry.homework_points,
                            participationPoints: entry.participation_points,
                            readingTheoryPoints: 0,
                            rank: entry.rank,
                          });
                          setAnalyticsMonth(selectedMonth);
                        }}
                        className={`
                          flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                          ${isCurrentUser 
                            ? 'bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border-2 border-primary/40 shadow-md' 
                            : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                          }
                        `}
                      >
                        {/* Rank */}
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-background/80 font-bold text-sm text-muted-foreground shadow-sm">
                          #{entry.rank}
                        </div>

                        {/* Avatar */}
                        <Avatar className={`h-10 w-10 border-2 ${isCurrentUser ? 'border-primary/50' : 'border-border/30'}`}>
                          <AvatarImage 
                            src={getAvatarUrl(entry.avatar_url) || getRandomAvatarUrl(entry.student_id)} 
                            alt={entry.student_name}
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

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {entry.student_name}
                          </p>
                          {isCurrentUser && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-0">
                              That's you! 🌟
                            </Badge>
                          )}
                        </div>

                        {/* Points */}
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-sm">
                          <Zap className="h-3.5 w-3.5 text-warning" />
                          <span className="font-bold text-foreground">{entry.total_points}</span>
                          <span className="text-xs text-muted-foreground">XP</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>
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
