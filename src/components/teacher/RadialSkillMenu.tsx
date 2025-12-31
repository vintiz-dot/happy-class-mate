import { MessageSquare, Ear, BookOpen, PenTool, Focus, Users, AlertTriangle } from "lucide-react";
import { SkillButton } from "./SkillButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const SKILL_CONFIG = {
  speaking: {
    icon: MessageSquare,
    label: "Speaking",
    subTags: [
      { label: "Good Pronunciation", value: "good_pronunciation" },
      { label: "Loud & Clear", value: "loud_clear" },
      { label: "Great Vocabulary", value: "great_vocabulary" },
      { label: "Fluent Response", value: "fluent_response" },
    ],
  },
  listening: {
    icon: Ear,
    label: "Listening",
    subTags: [
      { label: "Followed Instructions", value: "followed_instructions" },
      { label: "Good Comprehension", value: "good_comprehension" },
      { label: "Active Listening", value: "active_listening" },
    ],
  },
  reading: {
    icon: BookOpen,
    label: "Reading",
    subTags: [
      { label: "Good Expression", value: "good_expression" },
      { label: "Accurate Reading", value: "accurate_reading" },
      { label: "Good Pace", value: "good_pace" },
    ],
  },
  writing: {
    icon: PenTool,
    label: "Writing",
    subTags: [
      { label: "Neat Handwriting", value: "neat_handwriting" },
      { label: "Good Grammar", value: "good_grammar" },
      { label: "Creative Writing", value: "creative_writing" },
    ],
  },
};

const BEHAVIOR_CONFIG = {
  focus: {
    icon: Focus,
    label: "Focus",
    subTags: [
      { label: "Stayed on Task", value: "stayed_on_task" },
      { label: "No Distractions", value: "no_distractions" },
    ],
  },
  teamwork: {
    icon: Users,
    label: "Teamwork",
    subTags: [
      { label: "Helped Others", value: "helped_others" },
      { label: "Good Collaboration", value: "good_collaboration" },
      { label: "Shared Materials", value: "shared_materials" },
    ],
  },
};

const CORRECTION_OPTIONS = [
  { label: "Not Paying Attention", value: "not_paying_attention" },
  { label: "Disrupting Class", value: "disrupting_class" },
  { label: "Missing Homework", value: "missing_homework" },
  { label: "Late to Class", value: "late_to_class" },
  { label: "Other", value: "other" },
];

interface RadialSkillMenuProps {
  onSkillTap: (skill: string, points: number, subTag?: string) => void;
  onClose: () => void;
}

export function RadialSkillMenu({ onSkillTap, onClose }: RadialSkillMenuProps) {
  const [showCorrections, setShowCorrections] = useState(false);

  const handleSkillTap = (skill: string, subTag?: string) => {
    onSkillTap(skill, 1, subTag);
    onClose();
  };

  const handleBehaviorTap = (behavior: string, subTag?: string) => {
    onSkillTap(behavior, 1, subTag);
    onClose();
  };

  const handleCorrectionTap = (reason: string) => {
    onSkillTap("correction", -1, reason);
    setShowCorrections(false);
    onClose();
  };

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
            subTags={config.subTags}
            variant="positive"
            onTap={handleSkillTap}
          />
        ))}
      </div>

      {/* Behaviors Row */}
      <div className="flex gap-2 justify-center">
        {Object.entries(BEHAVIOR_CONFIG).map(([key, config]) => (
          <SkillButton
            key={key}
            icon={config.icon}
            label={config.label}
            skill={key}
            subTags={config.subTags}
            variant="positive"
            onTap={handleBehaviorTap}
          />
        ))}
        
        {/* Correction Button */}
        <Popover open={showCorrections} onOpenChange={setShowCorrections}>
          <PopoverTrigger asChild>
            <button
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-w-[56px] min-h-[56px] transition-all active:scale-95 touch-manipulation select-none bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400"
              onClick={() => setShowCorrections(true)}
            >
              <AlertTriangle className="h-6 w-6" />
              <span className="text-[10px] font-medium leading-tight">Correction</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" side="top" align="center">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 pb-1">Select Reason (-1 point)</p>
              {CORRECTION_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm h-9 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  onClick={() => handleCorrectionTap(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
