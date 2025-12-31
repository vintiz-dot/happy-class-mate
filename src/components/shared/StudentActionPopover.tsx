import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Trophy, History, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { awardPoints } from "@/lib/pointsHelper";
import { SKILL_CONFIG, BEHAVIOR_CONFIG, CORRECTION_CONFIG } from "@/lib/skillConfig";
import { soundManager } from "@/lib/soundManager";

interface StudentActionPopoverProps {
  studentId: string;
  studentName: string;
  classId: string;
  children: React.ReactNode;
  onViewHistory: () => void;
  canManagePoints?: boolean;
}

export function StudentActionPopover({
  studentId,
  studentName,
  classId,
  children,
  onViewHistory,
  canManagePoints = false,
}: StudentActionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const queryClient = useQueryClient();

  const awardPointsMutation = useMutation({
    mutationFn: async ({ skill, subTag }: { skill: string; subTag?: string }) => {
      const isCorrection = skill === "correction";
      const points = isCorrection ? -1 : 1;
      
      await awardPoints({
        studentIds: [studentId],
        classId,
        skill,
        points,
        subTag,
      });

      return points;
    },
    onSuccess: (pointsValue) => {
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard", classId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-leader"] });
      queryClient.invalidateQueries({ queryKey: ["student-points"] });
      queryClient.invalidateQueries({ queryKey: ["point-history"] });
      queryClient.invalidateQueries({ queryKey: ["live-assessment-students"] });
      
      soundManager.play(pointsValue > 0 ? "success" : "error");
      
      toast.success(
        `${pointsValue > 0 ? "+1" : "-1"} point for ${studentName}`,
        { description: "Leaderboard updated" }
      );
      
      setOpen(false);
      setShowSkills(false);
    },
    onError: (error: any) => {
      toast.error("Failed to add points", {
        description: error.message,
      });
    },
  });

  const handleSkillClick = (skill: string, subTag?: string) => {
    awardPointsMutation.mutate({ skill, subTag });
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setShowSkills(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="center" sideOffset={5}>
        {!showSkills ? (
          <div className="p-2 space-y-1">
            <p className="text-sm font-medium text-center py-2 border-b mb-2">{studentName}</p>
            {canManagePoints && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => setShowSkills(true)}
              >
                <Trophy className="h-4 w-4 text-amber-500" />
                Quick Award (+1 point)
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => {
                setOpen(false);
                onViewHistory();
              }}
            >
              <History className="h-4 w-4 text-muted-foreground" />
              View History
            </Button>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{studentName}</p>
              <Button variant="ghost" size="sm" onClick={() => setShowSkills(false)}>
                Back
              </Button>
            </div>

            {awardPointsMutation.isPending && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {!awardPointsMutation.isPending && (
              <>
                {/* Skills */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Skills (+1)</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(SKILL_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="justify-start gap-2 h-9"
                          onClick={() => handleSkillClick(key)}
                        >
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Behaviors */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Behaviors (+1)</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(BEHAVIOR_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="justify-start gap-2 h-9"
                          onClick={() => handleSkillClick(key)}
                        >
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Corrections */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Corrections (-1)</p>
                  <div className="grid grid-cols-1 gap-1">
                    {CORRECTION_CONFIG.subTags.slice(0, 3).map((tag) => (
                      <Button
                        key={tag.value}
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 h-8 text-destructive hover:text-destructive"
                        onClick={() => handleSkillClick("correction", tag.value)}
                      >
                        <CORRECTION_CONFIG.icon className="h-3 w-3" />
                        {tag.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
