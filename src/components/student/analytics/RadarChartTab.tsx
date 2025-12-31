import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Book, Pencil, Headphones, MessageSquare, Users, Shield, Trophy, Crown, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const SKILL_COLORS: Record<string, string> = {
  reading: "hsl(210, 100%, 60%)",
  writing: "hsl(150, 70%, 50%)",
  listening: "hsl(45, 90%, 55%)",
  speaking: "hsl(0, 80%, 60%)",
  teamwork: "hsl(280, 70%, 60%)",
  focus: "hsl(180, 60%, 50%)",
  personal: "hsl(320, 70%, 60%)",
};

interface RadarChartTabProps {
  studentId: string;
  classId: string;
  selectedMonth?: string;
}

const SKILL_LABELS: Record<string, string> = {
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
  teamwork: "Teamwork",
  focus: "Focus",
  personal: "Personal",
};

const SKILL_ICONS: Record<string, React.ReactNode> = {
  reading: <Book className="h-5 w-5" />,
  writing: <Pencil className="h-5 w-5" />,
  listening: <Headphones className="h-5 w-5" />,
  speaking: <MessageSquare className="h-5 w-5" />,
  teamwork: <Users className="h-5 w-5" />,
  focus: <Shield className="h-5 w-5" />,
  personal: <Star className="h-5 w-5" />,
};

const getSkillColor = (skill: string) => SKILL_COLORS[skill] || "hsl(200, 60%, 50%)";
const getSkillLabel = (skill: string) => SKILL_LABELS[skill] || skill.charAt(0).toUpperCase() + skill.slice(1);
const getSkillIcon = (skill: string) => SKILL_ICONS[skill] || <Shield className="h-5 w-5" />;

export function RadarChartTab({ studentId, classId }: RadarChartTabProps) {
  // Fetch all skills that exist in this class
  const { data: classSkillsList } = useQuery({
    queryKey: ["class-skills-list", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill")
        .eq("class_id", classId);

      if (error) throw error;
      
      // Get unique skills
      const uniqueSkills = [...new Set(data?.map(d => d.skill) || [])];
      return uniqueSkills;
    },
  });

  // Fetch student's total skill points (no averaging, just sum)
  const { data: studentSkills } = useQuery({
    queryKey: ["student-skills-total", studentId, classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill, score")
        .eq("student_id", studentId)
        .eq("class_id", classId);

      if (error) throw error;
      
      // Calculate total per skill (no cap)
      const skillTotals: Record<string, number> = {};
      
      data?.forEach((entry) => {
        if (!skillTotals[entry.skill]) {
          skillTotals[entry.skill] = 0;
        }
        skillTotals[entry.skill] += entry.score;
      });
      
      return skillTotals;
    },
  });

  // Fetch class highest for each skill (compare vs the best, not average)
  const { data: classHighest } = useQuery({
    queryKey: ["class-skill-highest", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_assessments")
        .select("skill, score, student_id")
        .eq("class_id", classId);

      if (error) throw error;
      
      // Group by student_id and skill, then find the highest total per skill
      const studentSkillTotals: Record<string, Record<string, number>> = {};
      
      data?.forEach((entry) => {
        if (!studentSkillTotals[entry.student_id]) {
          studentSkillTotals[entry.student_id] = {};
        }
        if (!studentSkillTotals[entry.student_id][entry.skill]) {
          studentSkillTotals[entry.student_id][entry.skill] = 0;
        }
        studentSkillTotals[entry.student_id][entry.skill] += entry.score;
      });
      
      // Find max per skill across all students
      const maxPerSkill: Record<string, number> = {};
      Object.values(studentSkillTotals).forEach(studentSkills => {
        Object.entries(studentSkills).forEach(([skill, total]) => {
          if (!maxPerSkill[skill] || total > maxPerSkill[skill]) {
            maxPerSkill[skill] = total;
          }
        });
      });
      
      return maxPerSkill;
    },
  });

  // Use only skills that exist in the class
  const activeSkills = classSkillsList || [];
  const hasData = activeSkills.length > 0 && studentSkills && Object.values(studentSkills).some(v => v > 0);

  // Calculate total points
  const studentTotal = studentSkills ? Object.values(studentSkills).reduce((a, b) => a + b, 0) : 0;
  const classHighestTotal = classHighest ? Object.values(classHighest).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-4">
      {hasData ? (
        <>
          {/* Skills vs Class Best Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-semibold text-foreground">Skills vs Class Best</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Total: <span className="font-bold text-foreground">{studentTotal}</span>
              <span className="mx-1">/</span>
              <span className="text-yellow-500">{classHighestTotal}</span>
            </div>
          </div>

          {/* Skill Cards */}
          <div className="space-y-3">
            {activeSkills.map((skill, index) => {
              const score = studentSkills?.[skill] ?? 0;
              const highest = classHighest?.[skill] ?? 1;
              const percentage = highest > 0 ? Math.round((score / highest) * 100) : 0;
              const isLeader = score >= highest && score > 0;
              
              return (
                <motion.div
                  key={skill}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative p-4 rounded-xl border transition-all ${
                    isLeader 
                      ? "bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/30" 
                      : "bg-card/50 border-border/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Skill Icon */}
                    <div 
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${getSkillColor(skill)}20` }}
                    >
                      <span style={{ color: getSkillColor(skill) }}>{getSkillIcon(skill)}</span>
                    </div>

                    {/* Skill Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{getSkillLabel(skill)}</span>
                          {isLeader && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-foreground">{score}</span>
                          <span className="text-xs text-muted-foreground">/ {highest}</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="relative h-2 rounded-full overflow-hidden bg-muted/50">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(percentage, 100)}%` }}
                          transition={{ delay: index * 0.05 + 0.2, duration: 0.5, ease: "easeOut" }}
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ 
                            background: isLeader 
                              ? `linear-gradient(90deg, ${getSkillColor(skill)}, hsl(45, 100%, 60%))` 
                              : getSkillColor(skill) 
                          }}
                        />
                      </div>
                      
                      {/* Percentage */}
                      <div className="flex justify-between mt-1">
                        <span className={`text-xs font-medium ${
                          percentage >= 80 ? 'text-green-500' : 
                          percentage >= 50 ? 'text-yellow-500' : 
                          'text-muted-foreground'
                        }`}>
                          {percentage}% of top
                        </span>
                        {percentage >= 80 && !isLeader && (
                          <span className="text-xs text-yellow-500 flex items-center gap-1">
                            <Star className="h-3 w-3" /> Almost there!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Crown className="h-3 w-3 text-yellow-500" />
              <span>= Class Leader</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-full bg-primary" />
              <span>= Your Score</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Shield className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">No skill data yet</p>
          <p className="text-sm">Assessments will appear here as your teacher adds them</p>
        </div>
      )}
    </div>
  );
}
