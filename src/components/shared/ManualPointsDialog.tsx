import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Minus, Sparkles, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { monthKey } from "@/lib/date";

interface ManualPointsDialogProps {
  classId: string;
  trigger?: React.ReactNode;
  isAdmin?: boolean;
}

export function ManualPointsDialog({ classId, trigger, isAdmin = false }: ManualPointsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [pointType, setPointType] = useState<"homework" | "participation">("participation");
  const [selectedHomework, setSelectedHomework] = useState("");
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch class info
  const { data: classInfo } = useQuery({
    queryKey: ["class-info", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch enrolled students for the class
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["enrolled-students", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students!inner(
            id,
            full_name,
            avatar_url,
            is_active
          )
        `)
        .eq("class_id", classId)
        .is("end_date", null);

      if (error) throw error;
      return data
        ?.map((e: any) => e.students)
        .filter((s: any) => s.is_active)
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
    enabled: open,
  });

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
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (isPositive) {
      // Happy ascending tone for positive points
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } else {
      // Descending tone for negative points
      oscillator.frequency.setValueAtTime(392, audioContext.currentTime); // G4
      oscillator.frequency.setValueAtTime(329.63, audioContext.currentTime + 0.1); // E4
      oscillator.frequency.setValueAtTime(261.63, audioContext.currentTime + 0.2); // C4
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    }
  };

  const addPointsMutation = useMutation({
    mutationFn: async () => {
      const pointsValue = parseInt(points);
      if (!selectedStudent || !points || !notes) {
        throw new Error("Please fill in all required fields");
      }

      if (!Number.isFinite(pointsValue)) {
        throw new Error("Points must be a valid number");
      }

      if (pointType === "homework" && !selectedHomework) {
        throw new Error("Please select a homework assignment");
      }

      // Validate that the student is enrolled in this class
      const { data: enrollment, error: enrollError } = await supabase
        .from("enrollments")
        .select("id")
        .eq("student_id", selectedStudent)
        .eq("class_id", classId)
        .is("end_date", null)
        .maybeSingle();

      if (enrollError) throw enrollError;
      if (!enrollment) {
        throw new Error("Student is not enrolled in this class");
      }

      const currentMonth = monthKey();

      // Insert point transaction
      const { error } = await supabase.from("point_transactions").insert({
        student_id: selectedStudent,
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
      queryClient.invalidateQueries({ queryKey: ["student-points"] });
      queryClient.invalidateQueries({ queryKey: ["point-history"] });
      
      // Play sound based on positive or negative
      playSound(pointsValue > 0);
      
      toast.success(
        `${pointsValue > 0 ? "Added" : "Deducted"} ${Math.abs(pointsValue)} ${pointType} points`,
        {
          description: "Leaderboard updated in real-time",
          icon: <Sparkles className="h-4 w-4" />,
        }
      );
      
      // Reset form
      setSelectedStudent("");
      setPoints("");
      setNotes("");
      setSelectedHomework("");
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Trophy className="h-4 w-4" />
            Add Points
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Manual Point Addition
          </DialogTitle>
          <DialogDescription>
            Award or deduct points for <strong>{classInfo?.name || "this class"}</strong>. Changes are reflected immediately on the leaderboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Student Selection */}
          <div className="space-y-2">
            <Label htmlFor="student" className="text-base font-semibold">
              Student *
            </Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger id="student" className="h-12">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {studentsLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : (
                  students?.map((student: any) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Point Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Point Type *</Label>
            <RadioGroup value={pointType} onValueChange={(value: any) => setPointType(value)}>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <RadioGroupItem value="participation" id="participation" />
                <Label htmlFor="participation" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Participation Points</div>
                  <div className="text-sm text-muted-foreground">For class engagement and activities</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <RadioGroupItem value="homework" id="homework" />
                <Label htmlFor="homework" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Homework Points</div>
                  <div className="text-sm text-muted-foreground">For homework assignments and submissions</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Homework Selection (only if homework type is selected) */}
          {pointType === "homework" && (
            <div className="space-y-2">
              <Label htmlFor="homework" className="text-base font-semibold">
                Homework Assignment *
              </Label>
              <Select value={selectedHomework} onValueChange={setSelectedHomework}>
                <SelectTrigger id="homework" className="h-12">
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
            <Label htmlFor="notes" className="text-base font-semibold">
              Reason / Notes *
            </Label>
            <Textarea
              id="notes"
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
                Submit Points
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
