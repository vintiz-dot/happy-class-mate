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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Book, Pencil, Headphones, Sword, Users, Shield, TrendingUp } from "lucide-react";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";

const SKILL_COLORS: Record<string, string> = {
  reading: "hsl(210, 100%, 60%)",
  writing: "hsl(150, 70%, 50%)",
  listening: "hsl(45, 90%, 55%)",
  speaking: "hsl(0, 80%, 60%)",
  teamwork: "hsl(280, 70%, 60%)",
  personal: "hsl(180, 60%, 50%)",
};

interface RadarChartTabProps {
  studentId: string;
  classId: string;
  selectedMonth?: string;
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

export function RadarChartTab({ studentId, classId, selectedMonth }: RadarChartTabProps) {
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
        acc[skill] = count > 0 ? Math.round(sum / count) : 50;
        return acc;
      }, {} as Record<string, number>);
    },
  });

  // Fetch skill trend data (last 6 months)
  const { data: skillTrend } = useQuery({
    queryKey: ["student-skill-trend", studentId, classId],
    queryFn: async () => {
      const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill, score, date")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .gte("date", sixMonthsAgo)
        .order("date", { ascending: true });

      if (error) throw error;
      
      // Group by month and calculate averages per skill
      const monthlyData: Record<string, Record<string, { sum: number; count: number }>> = {};
      
      data?.forEach((entry) => {
        const month = format(parseISO(entry.date), "yyyy-MM");
        if (!monthlyData[month]) {
          monthlyData[month] = {};
          SKILLS.forEach(skill => {
            monthlyData[month][skill] = { sum: 0, count: 0 };
          });
        }
        if (monthlyData[month][entry.skill]) {
          monthlyData[month][entry.skill].sum += entry.score;
          monthlyData[month][entry.skill].count += 1;
        }
      });
      
      // Convert to chart format
      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, skills]) => {
          const row: Record<string, string | number> = {
            month: format(parseISO(`${month}-01`), "MMM yy"),
          };
          SKILLS.forEach(skill => {
            const { sum, count } = skills[skill];
            row[skill] = count > 0 ? Math.round(sum / count) : 0;
          });
          return row;
        });
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
  const hasTrendData = skillTrend && skillTrend.length > 1;

  return (
    <div className="space-y-6">
      {/* Skill Icons Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {SKILLS.map((skill) => (
          <div
            key={skill}
            className="flex items-center gap-2 glass-panel px-3 py-2 rounded-lg"
          >
            <span style={{ color: SKILL_COLORS[skill] }}>{SKILL_ICONS[skill]}</span>
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

      {/* Skill Progress Trend Line Chart */}
      {hasTrendData && (
        <div className="glass-panel p-4 rounded-xl border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Skill Progress Over Time</h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={skillTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                />
                {SKILLS.map((skill) => (
                  <Line
                    key={skill}
                    type="monotone"
                    dataKey={skill}
                    name={SKILL_LABELS[skill]}
                    stroke={SKILL_COLORS[skill]}
                    strokeWidth={2}
                    dot={{ fill: SKILL_COLORS[skill], strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Monthly average scores over the last 6 months
          </p>
        </div>
      )}

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
                  <span style={{ color: SKILL_COLORS[skill] }}>{SKILL_ICONS[skill]}</span>
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
