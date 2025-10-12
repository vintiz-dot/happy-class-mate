import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Users, X } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  family_id: string | null;
}

interface Class {
  id: string;
  name: string;
}

interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  start_date: string;
  end_date: string | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_cadence: string | null;
  students: { full_name: string };
  classes: { name: string };
}

export function EnrollmentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [startDate, setStartDate] = useState("");
  const [discountType, setDiscountType] = useState<"" | "percent" | "amount">("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountCadence, setDiscountCadence] = useState<"" | "once" | "monthly">("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, classesRes, enrollmentsRes] = await Promise.all([
        supabase.from("students").select("id, full_name, family_id").eq("is_active", true),
        supabase.from("classes").select("id, name").eq("is_active", true),
        supabase
          .from("enrollments" as any)
          .select("*, students(full_name), classes(name)")
          .is("end_date", null)
          .order("created_at", { ascending: false }),
      ]);

      if (studentsRes.data) setStudents(studentsRes.data);
      if (classesRes.data) setClasses(classesRes.data);
      if (enrollmentsRes.data) setEnrollments(enrollmentsRes.data as any);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEnroll = async () => {
    if (!selectedStudent || !selectedClass) {
      toast({
        title: "Missing fields",
        description: "Please select both student and class",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate active enrollment
      const { data: existing } = await supabase
        .from("enrollments" as any)
        .select("id")
        .eq("student_id", selectedStudent)
        .eq("class_id", selectedClass)
        .is("end_date", null)
        .single();

      if (existing) {
        toast({
          title: "Duplicate enrollment",
          description: "Student is already enrolled in this class",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const enrollmentData: any = {
        student_id: selectedStudent,
        class_id: selectedClass,
        start_date: startDate || new Date().toISOString().split("T")[0],
      };

      if (discountType && discountValue && discountCadence) {
        enrollmentData.discount_type = discountType;
        enrollmentData.discount_value = parseInt(discountValue);
        enrollmentData.discount_cadence = discountCadence;
      }

      const { error } = await supabase.from("enrollments" as any).insert(enrollmentData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student enrolled successfully",
      });

      // Reset form
      setSelectedStudent("");
      setSelectedClass("");
      setStartDate("");
      setDiscountType("");
      setDiscountValue("");
      setDiscountCadence("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (enrollmentId: string) => {
    if (!confirm("Are you sure you want to end this enrollment?")) return;

    try {
      const { error } = await supabase
        .from("enrollments" as any)
        .update({ end_date: new Date().toISOString().split("T")[0] })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Enrollment ended",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Enroll Student
          </CardTitle>
          <CardDescription>Add a student to a class with optional enrollment discount</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="amount">Amount (VND)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {discountType && (
              <>
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percent" ? "e.g. 10 for 10%" : "e.g. 50000"}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Discount Cadence</Label>
                  <Select value={discountCadence} onValueChange={(v: any) => setDiscountCadence(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cadence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <Button onClick={handleEnroll} disabled={loading} className="w-full mt-4">
            Enroll Student
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Enrollments</CardTitle>
          <CardDescription>Current student enrollments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {enrollments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No active enrollments</p>
            ) : (
              enrollments.map((enrollment) => (
                <div key={enrollment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{enrollment.students.full_name}</p>
                    <p className="text-sm text-muted-foreground">{enrollment.classes.name}</p>
                    {enrollment.discount_type && (
                      <Badge variant="secondary" className="text-xs">
                        {enrollment.discount_cadence} discount: {enrollment.discount_value}
                        {enrollment.discount_type === "percent" ? "%" : " VND"}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnenroll(enrollment.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
