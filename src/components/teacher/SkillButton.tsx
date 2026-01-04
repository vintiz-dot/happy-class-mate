import { useState, useCallback } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { POINT_OPTIONS } from "@/lib/skillConfig";

interface SkillButtonProps {
  icon: LucideIcon;
  label: string;
  skill: string;
  variant?: "positive" | "negative";
  onTap: (skill: string, points: number) => void;
}

export function SkillButton({ 
  icon: Icon, 
  label, 
  skill, 
  variant = "positive",
  onTap 
}: SkillButtonProps) {
  const [showPointOptions, setShowPointOptions] = useState(false);

  const handleClick = useCallback(() => {
    setShowPointOptions(true);
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handlePointSelect = (points: number) => {
    onTap(skill, points);
    setShowPointOptions(false);
  };

  const baseClasses = cn(
    "flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-w-[56px] min-h-[56px] transition-all active:scale-95 touch-manipulation select-none",
    variant === "positive" 
      ? "bg-green-500/20 hover:bg-green-500/30 text-green-600 dark:text-green-400" 
      : "bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400"
  );

  return (
    <Popover open={showPointOptions} onOpenChange={setShowPointOptions}>
      <PopoverTrigger asChild>
        <button
          className={baseClasses}
          onClick={handleClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Icon className="h-6 w-6" />
          <span className="text-[10px] font-medium leading-tight">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top" align="center">
        <div className="flex gap-1">
          {POINT_OPTIONS.map((pts) => (
            <Button
              key={pts}
              variant="outline"
              size="sm"
              className="w-10 h-10 p-0 text-sm font-bold hover:bg-green-500/20 hover:text-green-600 hover:border-green-500"
              onClick={() => handlePointSelect(pts)}
            >
              +{pts}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
