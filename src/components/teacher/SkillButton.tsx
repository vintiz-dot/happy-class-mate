import { useState, useRef, useCallback } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SubTag {
  label: string;
  value: string;
}

interface SkillButtonProps {
  icon: LucideIcon;
  label: string;
  skill: string;
  subTags?: SubTag[];
  variant?: "positive" | "negative";
  onTap: (skill: string, subTag?: string) => void;
}

export function SkillButton({ 
  icon: Icon, 
  label, 
  skill, 
  subTags, 
  variant = "positive",
  onTap 
}: SkillButtonProps) {
  const [showSubTags, setShowSubTags] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handlePointerDown = useCallback(() => {
    isLongPress.current = false;
    if (subTags && subTags.length > 0) {
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        setShowSubTags(true);
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 500);
    }
  }, [subTags]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      onTap(skill);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }, [onTap, skill]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleSubTagClick = (subTag: SubTag) => {
    onTap(skill, subTag.value);
    setShowSubTags(false);
  };

  const baseClasses = cn(
    "flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-w-[56px] min-h-[56px] transition-all active:scale-95 touch-manipulation select-none",
    variant === "positive" 
      ? "bg-green-500/20 hover:bg-green-500/30 text-green-600 dark:text-green-400" 
      : "bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400"
  );

  if (subTags && subTags.length > 0) {
    return (
      <Popover open={showSubTags} onOpenChange={setShowSubTags}>
        <PopoverTrigger asChild>
          <button
            className={baseClasses}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Icon className="h-6 w-6" />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" side="top" align="center">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground px-2 pb-1">{label} - Quick Tags</p>
            {subTags.map((tag) => (
              <Button
                key={tag.value}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm h-9"
                onClick={() => handleSubTagClick(tag)}
              >
                {tag.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <button
      className={baseClasses}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}
