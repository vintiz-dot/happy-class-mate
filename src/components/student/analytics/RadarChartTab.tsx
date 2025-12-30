import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Book, Pencil, Headphones, Sword, Users, Shield } from "lucide-react";

interface RadarChartTabProps {
  studentId: string;
  classId: string;
}

const SKILLS = ["reading", "writing", "listening", "speaking", "teamwork", "personal"] as const;
const SKILL_LABELS: Record<string, string> = {
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
  teamwork: "Teamwork",
  personal: "Personal",
};

const SKILL_ICONS: Record<string, React.ReactNode> = {
  reading: <Book className="h-4 w-4" />,
  writing: <Pencil className="h-4 w-4" />,
  listening: <Headphones className="h-4 w-4" />,
  speaking: <Sword className="h-4 w-4" />,
  teamwork: <Users className="h-4 w-4" />,
  personal: <Shield className="h-4 w-4" />,
};

export function RadarChartTab({ studentId, classId }: RadarChartTabProps) {
  // Fetch student's skill averages
  const { data: studentSkills } = useQuery({
    queryKey: ["student-skills", studentId, classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill, score")
        .eq("student_id", studentId)
        .eq("class_id", classId);

      if (error) throw error;
      
      // Calculate averages per skill
      const skillTotals: Record<string, { sum: number; count: number }> = {};
      SKILLS.forEach(skill => {
        skillTotals[skill] = { sum: 0, count: 0 };
      });
      
      data?.forEach((entry) => {
        if (skillTotals[entry.skill]) {
          skillTotals[entry.skill].sum += entry.score;
          skillTotals[entry.skill].count += 1;
        }
      });
      
      return SKILLS.reduce((acc, skill) => {
        const { sum, count } = skillTotals[skill];
        acc[skill] = count > 0 ? Math.round(sum / count) : 0;
        return acc;
      }, {} as Record<string, number>);
    },
  });

  // Fetch class average for comparison
  const { data: classAverage } = useQuery({
    queryKey: ["class-skill-average", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill, score")
        .eq("class_id", classId);

      if (error) throw error;
      
      const skillTotals: Record<string, { sum: number; count: number }> = {};
      SKILLS.forEach(skill => {
        skillTotals[skill] = { sum: 0, count: 0 };
      });
      
      data?.forEach((entry) => {
        if (skillTotals[entry.skill]) {
          skillTotals[entry.skill].sum += entry.score;
          skillTotals[entry.skill].count += 1;
        }
      });
      
      return SKILLS.reduce((acc, skill) => {
        const { sum, count } = skillTotals[skill];
        acc[skill] = count > 0 ? Math.round(sum / count) : 50; // Default to 50 if no data
        return acc;
      }, {} as Record<string, number>);
    },
  });

  // Prepare chart data
  const chartData = SKILLS.map((skill) => ({
    skill: SKILL_LABELS[skill],
    student: studentSkills?.[skill] ?? 0,
    classAvg: classAverage?.[skill] ?? 50,
    fullMark: 100,
  }));

  const hasData = studentSkills && Object.values(studentSkills).some(v => v > 0);

  return (
    <div className="space-y-6">
      {/* Skill Icons Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {SKILLS.map((skill) => (
          <div
            key={skill}
            className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg"
          >
            <span className="text-primary">{SKILL_ICONS[skill]}</span>
            <span className="text-sm font-medium text-foreground">{SKILL_LABELS[skill]}</span>
          </div>
        ))}
      </div>

      {/* Radar Chart */}
      <div className="h-[350px] w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="skill"
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <Radar
                name="Class Average"
                dataKey="classAvg"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted))"
                fillOpacity={0.3}
                strokeDasharray="5 5"
              />
              <Radar
                name="Your Score"
                dataKey="student"
                stroke="hsl(var(--primary))"
                fill="url(#studentGradient)"
                fillOpacity={0.6}
                strokeWidth={2}
              />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => (
                  <span className="text-foreground font-medium">{value}</span>
                )}
              />
              <defs>
                <linearGradient id="studentGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(280, 100%, 70%)" />
                </linearGradient>
              </defs>
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Shield className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No skill data yet</p>
            <p className="text-sm">Assessments will appear here as your teacher adds them</p>
          </div>
        )}
      </div>

      {/* Skill Breakdown Cards */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SKILLS.map((skill) => {
            const score = studentSkills?.[skill] ?? 0;
            const avg = classAverage?.[skill] ?? 50;
            const diff = score - avg;
            
            return (
              <div
                key={skill}
                className="glass-panel p-4 rounded-xl border border-border/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary">{SKILL_ICONS[skill]}</span>
                  <span className="font-semibold text-foreground">{SKILL_LABELS[skill]}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{score}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
                <div className={`text-xs mt-1 ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} vs class avg
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
