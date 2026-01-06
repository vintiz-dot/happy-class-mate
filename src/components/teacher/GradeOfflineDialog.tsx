import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

interface Student {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface GradeOfflineDialogProps {
  homeworkId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GradeOfflineDialog({ homeworkId, isOpen, onClose, onSuccess }: GradeOfflineDialogProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [grade, setGrade] = useState("");
  const [points, setPoints] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (homeworkId && isOpen) {
      loadStudentsWithoutSubmission();
    }
  }, [homeworkId, isOpen]);

  const loadStudentsWithoutSubmission = async () => {
    if (!homeworkId) return;

    setLoading(true);
    try {
      // Get homework details including class_id
      const { data: homework, error: hwError } = await supabase
        .from("homeworks")
        .select("class_id")
        .eq("id", homeworkId)
        .single();

      if (hwError) throw hwError;

      // Get all enrolled students in the class
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("student_id, students(id, full_name, avatar_url)")
        .eq("class_id", homework.class_id);

      if (enrollError) throw enrollError;

      // Get all students who have submitted
      const { data: submissions, error: subError } = await supabase
        .from("homework_submissions")
        .select("student_id")
        .eq("homework_id", homeworkId);

      if (subError) throw subError;

      const submittedStudentIds = new Set(submissions?.map((s) => s.student_id) || []);

      // Filter out students who have already submitted
      const studentsWithoutSubmission =
        enrollments?.map((e) => e.students).filter((s): s is Student => s !== null && !submittedStudentIds.has(s.id)) ||
        [];

      setStudents(studentsWithoutSubmission);
    } catch (error: any) {
      toast({
        title: "Error loading students",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitGrade = async () => {
    if (!selectedStudent || !homeworkId) {
      toast({
        title: "Missing information",
        description: "Please select a student",
        variant: "destructive",
      });
      return;
    }

    if (!grade) {
      toast({
        title: "Missing grade",
        description: "Please provide a grade",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Create or update homework submission with grade
      const { error: submissionError } = await supabase.from("homework_submissions").upsert({
        homework_id: homeworkId,
        student_id: selectedStudent.id,
        status: "graded",
        grade: grade,
        teacher_feedback: feedback || null,
        graded_at: new Date().toISOString(),
        submission_text: "Graded offline",
      });

      if (submissionError) throw submissionError;

      // Update student points if provided
      const pointsValue = Number(points);
      if (Number.isFinite(pointsValue) && pointsValue >= -100 && pointsValue <= 100) {

        // Get homework details for class_id and due_date
        const { data: homeworkData } = await supabase
          .from("homeworks")
          .select("class_id, due_date, title")
          .eq("id", homeworkId)
          .single();

        // Use homework due_date for month attribution, not grading date
        const effectiveDate = homeworkData?.due_date || new Date().toISOString().slice(0, 10);
        const month = effectiveDate.slice(0, 7);

        // Insert point transaction - the trigger will update student_points automatically
        const { error: pointsError } = await supabase.from("point_transactions").insert({
          student_id: selectedStudent.id,
          class_id: homeworkData?.class_id,
          month: month,
          type: "homework",
          points: pointsValue,
          homework_id: homeworkId,
          homework_title: homeworkData?.title,
          date: effectiveDate,
        });

        if (pointsError) throw pointsError;
      }

      toast({
        title: "Success",
        description: `Offline grade submitted for ${selectedStudent.full_name}`,
      });

      // Invalidate leaderboard queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["class-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-leader"] });

      // Reset form and reload students
      setSelectedStudent(null);
      setGrade("");
      setPoints("");
      setFeedback("");
      loadStudentsWithoutSubmission();
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error submitting grade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grade Offline Submissions</DialogTitle>
          <DialogDescription>Grade students who submitted their work offline or didn't submit online</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">All students have submitted online!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Student Selection */}
            <div className="space-y-3">
              <Label>Select Student</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-2">
                {students.map((student) => (
                  <Card
                    key={student.id}
                    className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                      selectedStudent?.id === student.id ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.full_name}</p>
                        <Badge variant="outline" className="text-xs">
                          No submission
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Grading Form */}
            {selectedStudent && (
              <div className="space-y-4 border-t pt-4">
                <div className="bg-primary/5 p-3 rounded-lg">
                  <p className="font-medium">Grading: {selectedStudent.full_name}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade">Grade *</Label>
                  <Input
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g., A, B+, 95/100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points">Points (-100 to 100)</Label>
                  <Input
                    id="points"
                    type="number"
                    min="-100"
                    max="100"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="Optional leaderboard points"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback">Teacher Feedback</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Optional feedback for the student..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSubmitGrade} disabled={submitting} className="flex-1">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit Grade
                  </Button>
                  <Button onClick={() => setSelectedStudent(null)} variant="outline" disabled={submitting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
