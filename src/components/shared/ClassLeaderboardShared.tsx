import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Flag, Rocket, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PointHistoryDialog } from "@/components/admin/PointHistoryDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getRandomAvatarUrl } from "@/lib/avatars";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- 1. Starfield Animation Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.parentElement?.clientWidth || window.innerWidth;
    let height = canvas.parentElement?.clientHeight || 600;
    let stars: any[] = [];
    let animationFrameId: number;

    const resize = () => {
      if (canvas.parentElement) {
        width = canvas.parentElement.clientWidth;
        height = canvas.parentElement.clientHeight;
        canvas.width = width;
        canvas.height = height;
        initStars();
      }
    };

    class StarObj {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      fadeDir: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random();
        this.fadeDir = 1;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
        this.opacity += 0.01 * this.fadeDir;
        if (this.opacity >= 1 || this.opacity <= 0.2) this.fadeDir *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function initStars() {
      stars = [];
      const starCount = Math.floor((width * height) / 6000);
      for (let i = 0; i < starCount; i++) {
        stars.push(new StarObj());
      }
    }

    function animateStars() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        star.update();
        star.draw();
      });
      animationFrameId = requestAnimationFrame(animateStars);
    }

    // Initialize
    resize();
    animateStars();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // --- 2. Data Fetching & Realtime (Preserved) ---
  useEffect(() => {
    const channel = supabase
      .channel("student-points-changes-shared")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_points",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["class-leaderboard", classId] });
          queryClient.invalidateQueries({ queryKey: ["monthly-leader", classId] });
        },
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
        .select(`*, students (id, full_name, avatar_url)`)
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

  // --- 3. Render Logic ---
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Rocket className="h-6 w-6 text-yellow-900" />; // Changed to Rocket for theme
      case 2:
        return <Medal className="h-6 w-6 text-gray-600" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-800" />;
      default:
        return <span className="text-white/80 font-bold">#{rank}</span>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96 text-white">Scanning Deep Space...</div>;
  }

  const topThree = leaderboard?.slice(0, 3) || [];
  const restOfList = leaderboard?.slice(3, 10) || [];

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl min-h-[700px] border-2 border-white/10">
      {/* Deep Space Background */}
      <div className="absolute inset-0 bg-[#0f172a] z-0"></div>

      {/* Canvas for Stars */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* Content Container (Glassmorphism) */}
      <div className="relative z-10 p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF9F43] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Star className="text-white w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-lg">
                Venus <span className="text-[#FFD700]">Rankings</span>
              </h1>
              <p className="text-blue-200 text-sm font-medium">Elite Space Crew</p>
            </div>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white backdrop-blur-md rounded-xl h-12 font-bold focus:ring-[#FFD700]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-white/20 text-white">
              {Array.from({ length: 6 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const month = date.toISOString().slice(0, 7);
                return (
                  <SelectItem key={month} value={month} className="focus:bg-white/10 focus:text-[#FFD700]">
                    {date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {leaderboard?.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-white/50">
            <Rocket className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-bold">No data found in this sector.</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium - Venus Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-end justify-center max-w-4xl mx-auto w-full">
              {/* Reorder for visual podium: 2nd, 1st, 3rd */}
              {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((entry: any, i) => {
                const isCurrentStudent = currentStudentId && entry.student_id === currentStudentId;
                // Adjust ranking display order logic
                const actualRank = entry.rank;
                const isFirst = actualRank === 1;

                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col items-center cursor-pointer transition-transform hover:scale-105 duration-300 ${isFirst ? "-mt-12 order-2 md:order-none" : ""}`}
                    onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                  >
                    <div className="relative mb-4 group">
                      {/* Avatar Ring */}
                      <div
                        className={`
                        rounded-full p-1 bg-gradient-to-br 
                        ${isFirst ? "from-[#FFD700] via-[#FF9F43] to-[#d35400] p-1.5 shadow-[0_0_30px_rgba(255,215,0,0.4)]" : "from-blue-400 to-purple-500 shadow-lg"}
                        ${isCurrentStudent ? "ring-4 ring-white ring-opacity-50" : ""}
                      `}
                      >
                        <Avatar className={`${isFirst ? "h-32 w-32" : "h-24 w-24"} border-4 border-[#0f172a]`}>
                          <AvatarImage
                            src={getAvatarUrl(entry.students?.avatar_url) || getRandomAvatarUrl(entry.student_id)}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-[#1e293b] text-white font-bold">
                            {entry.students?.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Rank Badge */}
                      <div
                        className={`
                        absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-2 border-[#0f172a]
                        ${isFirst ? "bg-[#FFD700] text-yellow-900 scale-125" : "bg-gray-200 text-gray-700"}
                      `}
                      >
                        {isFirst ? <Rocket size={14} /> : <span className="font-bold text-sm">{actualRank}</span>}
                      </div>
                    </div>

                    <div className="text-center">
                      <p className={`font-bold text-white truncate max-w-[140px] ${isFirst ? "text-xl" : "text-lg"}`}>
                        {entry.students?.full_name}
                      </p>
                      <div className="flex items-center justify-center gap-1 text-[#FFD700] mt-1">
                        <span className="text-2xl font-black">{entry.total_points}</span>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-80">XP</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ranks 4-10 List - Glassmorphism */}
            {restOfList.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden max-w-4xl mx-auto w-full">
                <div className="grid grid-cols-[60px_1fr_100px] gap-4 px-6 py-3 bg-black/20 border-b border-white/10 text-xs font-bold text-blue-200 uppercase tracking-widest">
                  <div>Rank</div>
                  <div>Cadet</div>
                  <div className="text-right">Mission XP</div>
                </div>

                <div className="divide-y divide-white/5">
                  {restOfList.map((entry: any) => {
                    const isCurrentStudent = currentStudentId && entry.student_id === currentStudentId;
                    return (
                      <div
                        key={entry.id}
                        className={`
                          grid grid-cols-[60px_1fr_100px] gap-4 px-6 py-4 items-center cursor-pointer transition-colors
                          hover:bg-white/10
                          ${isCurrentStudent ? "bg-[#FFD700]/10 border-l-4 border-[#FFD700]" : ""}
                        `}
                        onClick={() => setSelectedStudent({ id: entry.student_id, name: entry.students?.full_name })}
                      >
                        <div className="font-black text-white/50 text-lg">#{entry.rank}</div>

                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-white/20">
                            <AvatarImage
                              src={getAvatarUrl(entry.students?.avatar_url) || getRandomAvatarUrl(entry.student_id)}
                            />
                            <AvatarFallback className="bg-white/10 text-white text-xs">
                              {entry.students?.full_name?.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className={`font-bold ${isCurrentStudent ? "text-[#FFD700]" : "text-white"}`}>
                              {entry.students?.full_name}
                            </span>
                            {isCurrentStudent && (
                              <span className="text-[10px] text-[#FFD700] uppercase font-bold">You</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right font-mono font-bold text-lg text-blue-200">{entry.total_points}</div>
                      </div>
                    );
                  })}
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
    </div>
  );
}
