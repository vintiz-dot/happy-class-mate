import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Trophy, History, Plus, Minus, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { monthKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [pointType, setPointType] = useState<"homework" | "participation">("participation");
  const [selectedHomework, setSelectedHomework] = useState("");
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch active homework for the class
  const { data: homeworks, isLoading: homeworksLoading } = useQuery({
    queryKey: ["class-homeworks", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homeworks")
        .select("id, title, due_date")
        .eq("class_id", classId)
        .order("due_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: showAddPoints && pointType === "homework",
  });

  const playSound = (isPositive: boolean) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (isPositive) {
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      } else {
        oscillator.frequency.setValueAtTime(392, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(329.63, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(261.63, audioContext.currentTime + 0.2);
      }
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (e) {
      // Ignore audio errors
    }
  };

  const addPointsMutation = useMutation({
    mutationFn: async () => {
      const pointsValue = parseInt(points);
      if (!points || !notes) {
        throw new Error("Please fill in all required fields");
      }

      if (!Number.isFinite(pointsValue)) {
        throw new Error("Points must be a valid number");
      }

      if (pointType === "homework" && !selectedHomework) {
        throw new Error("Please select a homework assignment");
      }

      const currentMonth = monthKey();

      const { error } = await supabase.from("point_transactions").insert({
        student_id: studentId,
        class_id: classId,
        month: currentMonth,
        type: pointType,
        points: pointsValue,
        notes: notes,
        date: new Date().toISOString().slice(0, 10),
        homework_id: pointType === "homework" ? selectedHomework : null,
      });

      if (error) throw error;
      return pointsValue;
    },
    onSuccess: (pointsValue) => {
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard", classId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-leader"] });
      queryClient.invalidateQueries({ queryKey: ["student-points"] });
      queryClient.invalidateQueries({ queryKey: ["point-history"] });
      queryClient.invalidateQueries({ queryKey: ["point-breakdown"] });
      
      playSound(pointsValue > 0);
      
      toast.success(
        `${pointsValue > 0 ? "Added" : "Deducted"} ${Math.abs(pointsValue)} points to ${studentName}`,
        { description: "Leaderboard updated" }
      );
      
      resetForm();
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error("Failed to add points", {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setPoints("");
    setNotes("");
    setSelectedHomework("");
    setShowAddPoints(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const setPointsQuick = (value: number) => {
    setPoints(value.toString());
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center" sideOffset={5}>
        {!showAddPoints ? (
          <div className="p-2 space-y-1">
            <p className="text-sm font-medium text-center py-2 border-b mb-2">{studentName}</p>
            {canManagePoints && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => setShowAddPoints(true)}
              >
                <Trophy className="h-4 w-4 text-amber-500" />
                Add Points
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
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{studentName}</p>
              <Button variant="ghost" size="sm" onClick={() => setShowAddPoints(false)}>
                Back
              </Button>
            </div>

            {/* Point Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type</Label>
              <RadioGroup value={pointType} onValueChange={(v: any) => setPointType(v)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="participation" id={`pop-part-${studentId}`} />
                  <Label htmlFor={`pop-part-${studentId}`} className="text-sm">Participation</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="homework" id={`pop-hw-${studentId}`} />
                  <Label htmlFor={`pop-hw-${studentId}`} className="text-sm">Homework</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Homework Selection */}
            {pointType === "homework" && (
              <Select value={selectedHomework} onValueChange={setSelectedHomework}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select homework" />
                </SelectTrigger>
                <SelectContent>
                  {homeworksLoading ? (
                    <div className="p-2 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : homeworks && homeworks.length > 0 ? (
                    homeworks.map((hw: any) => (
                      <SelectItem key={hw.id} value={hw.id}>
                        {hw.title}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No homework found
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Quick Points */}
            <div className="grid grid-cols-4 gap-1">
              {[-20, -10, 10, 20].map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsQuick(val)}
                  className="h-10 flex flex-col gap-0 p-1"
                >
                  {val > 0 ? (
                    <Plus className="h-3 w-3 text-green-600" />
                  ) : (
                    <Minus className="h-3 w-3 text-destructive" />
                  )}
                  <span className="text-xs">{val > 0 ? `+${val}` : val}</span>
                </Button>
              ))}
            </div>

            <Input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Custom amount"
              className="h-9 text-center"
            />

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason (required)"
              rows={2}
              className="resize-none text-sm"
            />

            <Button
              onClick={() => addPointsMutation.mutate()}
              disabled={addPointsMutation.isPending || !points || !notes}
              size="sm"
              className="w-full"
            >
              {addPointsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
