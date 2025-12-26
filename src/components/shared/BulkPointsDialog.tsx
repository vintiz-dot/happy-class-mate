import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Minus, Sparkles, Trophy, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { monthKey } from "@/lib/date";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getRandomAvatarUrl } from "@/lib/avatars";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SelectedStudent {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface BulkPointsDialogProps {
  classId: string;
  selectedStudents: SelectedStudent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkPointsDialog({
  classId,
  selectedStudents,
  open,
  onOpenChange,
  onSuccess,
}: BulkPointsDialogProps) {
  const [pointType, setPointType] = useState<"homework" | "participation">("participation");
  const [selectedHomework, setSelectedHomework] = useState("");
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch active homework for the class (only if homework type is selected)
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
    enabled: open && pointType === "homework",
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
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      } else {
        oscillator.frequency.setValueAtTime(392, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(329.63, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(261.63, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      }
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

      if (selectedStudents.length === 0) {
        throw new Error("No students selected");
      }

      const currentMonth = monthKey();

      // Insert point transactions for all selected students
      const transactions = selectedStudents.map((student) => ({
        student_id: student.id,
        class_id: classId,
        month: currentMonth,
        type: pointType,
        points: pointsValue,
        notes: notes,
        date: new Date().toISOString().slice(0, 10),
        homework_id: pointType === "homework" ? selectedHomework : null,
      }));

      const { error } = await supabase.from("point_transactions").insert(transactions);

      if (error) throw error;
      return pointsValue;
    },
    onSuccess: (pointsValue) => {
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard", classId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-leader"] });
      queryClient.invalidateQueries({ queryKey: ["student-points"] });
      queryClient.invalidateQueries({ queryKey: ["point-history"] });
      queryClient.invalidateQueries({ queryKey: ["point-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["available-months"] });
      
      playSound(pointsValue > 0);
      
      toast.success(
        `${pointsValue > 0 ? "Added" : "Deducted"} ${Math.abs(pointsValue)} ${pointType} points to ${selectedStudents.length} students`,
        {
          description: "Leaderboard updated in real-time",
          icon: <Sparkles className="h-4 w-4" />,
        }
      );
      
      // Reset form
      setPoints("");
      setNotes("");
      setSelectedHomework("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error("Failed to add points", {
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    addPointsMutation.mutate();
  };

  const setPointsQuick = (value: number) => {
    setPoints(value.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Add Points to {selectedStudents.length} Students
          </DialogTitle>
          <DialogDescription>
            Award or deduct points for the selected students. Changes are reflected immediately on the leaderboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Selected Students Preview */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Selected Students ({selectedStudents.length})
            </Label>
            <ScrollArea className="h-24 rounded-lg border p-3 bg-muted/50">
              <div className="flex flex-wrap gap-2">
                {selectedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 bg-background rounded-full px-3 py-1.5 border shadow-sm"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={getAvatarUrl(student.avatarUrl) || getRandomAvatarUrl(student.id)}
                        alt={student.name}
                      />
                      <AvatarFallback className="text-[10px]">
                        {student.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{student.name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Point Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Point Type *</Label>
            <RadioGroup value={pointType} onValueChange={(value: any) => setPointType(value)}>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <RadioGroupItem value="participation" id="bulk-participation" />
                <Label htmlFor="bulk-participation" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Participation Points</div>
                  <div className="text-sm text-muted-foreground">For class engagement and activities</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <RadioGroupItem value="homework" id="bulk-homework" />
                <Label htmlFor="bulk-homework" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Homework Points</div>
                  <div className="text-sm text-muted-foreground">For homework assignments and submissions</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Homework Selection (only if homework type is selected) */}
          {pointType === "homework" && (
            <div className="space-y-2">
              <Label htmlFor="bulk-hw" className="text-base font-semibold">
                Homework Assignment *
              </Label>
              <Select value={selectedHomework} onValueChange={setSelectedHomework}>
                <SelectTrigger id="bulk-hw" className="h-12">
                  <SelectValue placeholder="Select homework" />
                </SelectTrigger>
                <SelectContent>
                  {homeworksLoading ? (
                    <div className="p-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : homeworks && homeworks.length > 0 ? (
                    homeworks.map((hw: any) => (
                      <SelectItem key={hw.id} value={hw.id}>
                        {hw.title} {hw.due_date && `(Due: ${new Date(hw.due_date).toLocaleDateString()})`}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No homework assignments found for this class
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Points Amount */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Points Amount *</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPointsQuick(-20)}
                className="h-14 flex flex-col"
              >
                <Minus className="h-4 w-4 text-destructive" />
                <span className="text-xs mt-1">-20</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPointsQuick(-10)}
                className="h-14 flex flex-col"
              >
                <Minus className="h-4 w-4 text-destructive" />
                <span className="text-xs mt-1">-10</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPointsQuick(10)}
                className="h-14 flex flex-col"
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span className="text-xs mt-1">+10</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPointsQuick(20)}
                className="h-14 flex flex-col"
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span className="text-xs mt-1">+20</span>
              </Button>
            </div>
            <Input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Or enter custom amount"
              className="h-12 text-center text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground text-center">
              Negative values will deduct points • No caps on point values
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="bulk-notes" className="text-base font-semibold">
              Reason / Notes *
            </Label>
            <Textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why you're adding/deducting these points (required for audit trail)"
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={addPointsMutation.isPending}
            size="lg"
            className="w-full h-12 text-base"
          >
            {addPointsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Add Points to {selectedStudents.length} Students
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
