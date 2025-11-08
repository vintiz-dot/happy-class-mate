import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Minus } from "lucide-react";
import { monthKey } from "@/lib/date";

export function ManualPointAdjustment() {
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch active students
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["active-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch active classes
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["active-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedClass || !points || !reason) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const pointsValue = Number(points);
    if (!Number.isFinite(pointsValue) || pointsValue < -100 || pointsValue > 100) {
      toast({
        title: "Invalid points",
        description: "Points must be between -100 and 100",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const currentMonth = monthKey();

      // Insert point transaction
      const { error: transactionError } = await supabase.from("point_transactions").insert({
        student_id: selectedStudent,
        class_id: selectedClass,
        month: currentMonth,
        type: "adjustment",
        points: pointsValue,
        notes: reason,
        date: new Date().toISOString().slice(0, 10),
      });

      if (transactionError) throw transactionError;

      toast({
        title: "Success",
        description: `${pointsValue > 0 ? "Added" : "Deducted"} ${Math.abs(pointsValue)} points`,
      });

      // Reset form
      setSelectedStudent("");
      setSelectedClass("");
      setPoints("");
      setReason("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPointsQuick = (value: number) => {
    setPoints(value.toString());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Point Adjustment</CardTitle>
        <CardDescription>Add or subtract points from students with audit trail</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="student">Student *</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger id="student">
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              {studentsLoading ? (
                <div className="p-2 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : (
                students?.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.full_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="class">Class *</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger id="class">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classesLoading ? (
                <div className="p-2 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : (
                classes?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="points">Points (-100 to 100) *</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPointsQuick(-10)}
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-1" />
              -10
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPointsQuick(-5)}
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-1" />
              -5
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPointsQuick(5)}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              +5
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPointsQuick(10)}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              +10
            </Button>
          </div>
          <Input
            id="points"
            type="number"
            min="-100"
            max="100"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Enter custom value"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason *</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you adjusting points? (This will be recorded in the audit trail)"
            rows={3}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Submit Adjustment
        </Button>
      </CardContent>
    </Card>
  );
}