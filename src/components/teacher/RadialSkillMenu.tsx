import { AlertTriangle, GraduationCap } from "lucide-react";
import { SkillButton } from "./SkillButton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SKILL_CONFIG, BEHAVIOR_CONFIG, CORRECTION_OPTIONS, DEDUCTION_OPTIONS } from "@/lib/skillConfig";

interface RadialSkillMenuProps {
  onSkillTap: (skill: string, points: number, subTag?: string) => void;
  onClose: () => void;
  onReadingTheoryClick?: () => void;
}

export function RadialSkillMenu({ onSkillTap, onClose, onReadingTheoryClick }: RadialSkillMenuProps) {
  const [stage, setStage] = useState<"main" | "correction-reasons" | "correction-points">("main");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const handleSkillTap = (skill: string, points: number) => {
    onSkillTap(skill, points);
    onClose();
  };

  const handleBehaviorTap = (behavior: string, points: number) => {
    onSkillTap(behavior, points);
    onClose();
  };

  const handleCorrectionClick = () => {
    setStage("correction-reasons");
  };

  const handleReadingTheoryButtonClick = () => {
    if (onReadingTheoryClick) {
      onReadingTheoryClick();
      onClose();
    }
  };

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setStage("correction-points");
  };

  const handleDeductionSelect = (points: number) => {
    if (selectedReason) {
      onSkillTap("correction", points, selectedReason);
    }
    setStage("main");
    setSelectedReason(null);
    onClose();
  };

  const handleBack = () => {
    if (stage === "correction-points") {
      setStage("correction-reasons");
      setSelectedReason(null);
    } else {
      setStage("main");
    }
  };

  // Correction reasons stage
  if (stage === "correction-reasons") {
    return (
      <div className="glass rounded-2xl p-3 shadow-xl border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
            ← Back
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Select Reason</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CORRECTION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className="h-auto py-2 px-3 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-500/30"
              onClick={() => handleReasonSelect(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Correction points stage
  if (stage === "correction-points") {
    const reasonLabel = CORRECTION_OPTIONS.find(o => o.value === selectedReason)?.label || selectedReason;
    return (
      <div className="glass rounded-2xl p-3 shadow-xl border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
            ← Back
          </Button>
          <span className="text-sm font-medium text-muted-foreground truncate">{reasonLabel}</span>
        </div>
        <div className="flex gap-2 justify-center">
          {DEDUCTION_OPTIONS.map((pts) => (
            <Button
              key={pts}
              variant="outline"
              size="sm"
              className="w-12 h-12 p-0 text-lg font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/30"
              onClick={() => handleDeductionSelect(pts)}
            >
              {pts}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Main stage - skills and behaviors
  return (
    <div className="glass rounded-2xl p-3 shadow-xl border border-border/50">
      {/* Skills Row */}
      <div className="flex gap-2 mb-2">
        {Object.entries(SKILL_CONFIG).map(([key, config]) => (
          <SkillButton
            key={key}
            icon={config.icon}
            label={config.label}
            skill={key}
            variant="positive"
            onTap={handleSkillTap}
          />
        ))}
      </div>

      {/* Behaviors Row + Reading Theory + Correction */}
      <div className="flex gap-2 justify-center">
        {Object.entries(BEHAVIOR_CONFIG).map(([key, config]) => (
          <SkillButton
            key={key}
            icon={config.icon}
            label={config.label}
            skill={key}
            variant="positive"
            onTap={handleBehaviorTap}
          />
        ))}
        
        {/* Reading Theory Button - Opens cumulative score entry */}
        {onReadingTheoryClick && (
          <button
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-w-[56px] min-h-[56px] transition-all active:scale-95 touch-manipulation select-none bg-teal-500/20 hover:bg-teal-500/30 text-teal-600 dark:text-teal-400"
            onClick={handleReadingTheoryButtonClick}
          >
            <GraduationCap className="h-6 w-6" />
            <span className="text-[10px] font-medium leading-tight">RT</span>
          </button>
        )}
        
        {/* Correction Button */}
        <button
          className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-w-[56px] min-h-[56px] transition-all active:scale-95 touch-manipulation select-none bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400"
          onClick={handleCorrectionClick}
        >
          <AlertTriangle className="h-6 w-6" />
          <span className="text-[10px] font-medium leading-tight">Correction</span>
        </button>
      </div>
    </div>
  );
}
