import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingDown, Check } from "lucide-react";
import { formatVND } from "@/lib/invoice/formatter";

interface SiblingDiscountCardProps {
  studentId: string;
  month?: string;
}

interface ClassTuition {
  classId: string;
  className: string;
  sessionsCount: number;
  totalAmount: number;
}

export function SiblingDiscountCard({ studentId, month }: SiblingDiscountCardProps) {
  // Default to current month if not provided
  const currentMonth = month || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const { data: student } = useQuery({
    queryKey: ["student-basic", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("family_id")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: siblingState, isLoading } = useQuery({
    queryKey: ["sibling-discount-state", student?.family_id, currentMonth],
    queryFn: async () => {
      if (!student?.family_id) return null;

      const { data, error } = await supabase
        .from("sibling_discount_state")
        .select("*")
        .eq("family_id", student.family_id)
        .eq("month", currentMonth)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!student?.family_id,
  });

  // Get all enrollments and their tuition breakdown
  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments-tuition", studentId, currentMonth],
    queryFn: async () => {
      // Fetch enrollments - explicitly typed to avoid deep type instantiation
      const enrollQuery = await (supabase as any)
        .from("enrollments")
        .select("id, class_id")
        .eq("student_id", studentId)
        .eq("status", "active");

      const { data: enrollData, error: enrollError } = enrollQuery;

      if (enrollError) throw enrollError;
      if (!enrollData || enrollData.length === 0) return [];

      // Fetch class details separately
      const classIds = enrollData.map((e: any) => e.class_id);
      const classQuery = await (supabase as any)
        .from("classes")
        .select("id, name, session_rate_vnd")
        .in("id", classIds);

      const { data: classData, error: classError } = classQuery;

      if (classError) throw classError;

      // Get tuition calculation to get per-class session counts
      const { data: tuitionData, error: tuitionError } = await supabase.functions.invoke('calculate-tuition', {
        body: { studentId, month: currentMonth }
      });

      if (tuitionError) throw tuitionError;

      // Map enrollments to class tuition data
      const classTuitions: ClassTuition[] = enrollData.map((enrollment: any) => {
        const classInfo = classData?.find((c: any) => c.id === enrollment.class_id);
        
        // Count sessions for this class from session details
        const classSessions = (tuitionData?.sessionDetails || []).filter(
          (s: any) => s.class_id === enrollment.class_id
        );
        
        const sessionsCount = classSessions.length;
        const totalAmount = sessionsCount * (classInfo?.session_rate_vnd || 0);

        return {
          classId: enrollment.class_id || '',
          className: classInfo?.name || 'Unknown',
          sessionsCount,
          totalAmount,
        };
      });

      return classTuitions;
    },
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Sibling Discount</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!siblingState || siblingState.status !== 'assigned' || siblingState.winner_student_id !== studentId) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Sibling Discount</CardTitle>
          </div>
          <CardDescription>
            {siblingState?.status === 'pending' 
              ? 'Threshold not met for this month'
              : siblingState?.status === 'none'
              ? 'Not eligible (requires ≥2 students in family)'
              : 'Not the discount recipient this month'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Badge variant="secondary" className="text-xs">
              {siblingState?.status === 'assigned' ? 'Sibling Winner' : 'Not Active'}
            </Badge>
            {siblingState?.reason && (
              <p className="text-sm text-muted-foreground">{siblingState.reason}</p>
            )}
          </div>

          {/* Show all enrolled classes even if not winner */}
          {enrollments && enrollments.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Enrolled Classes</p>
              {enrollments.map(enrollment => (
                <div key={enrollment.classId} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{enrollment.className}</p>
                      <p className="text-xs text-muted-foreground">{enrollment.sessionsCount} sessions</p>
                    </div>
                    <p className="text-sm font-semibold">{formatVND(enrollment.totalAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // This student is the winner - show all classes with discount applied
  const discountPercent = siblingState.sibling_percent || 0;
  const winnerClassId = siblingState.winner_class_id;

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <CardTitle className="text-green-700 dark:text-green-300">Sibling Discount Active</CardTitle>
            <CardDescription>
              {discountPercent}% discount applied to highest tuition class
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Winner
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrollments && enrollments.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Monthly Tuition Breakdown</p>
            
            {enrollments.map(enrollment => {
              const isWinnerClass = enrollment.classId === winnerClassId;
              const discountAmount = isWinnerClass 
                ? Math.round(enrollment.totalAmount * (discountPercent / 100))
                : 0;
              const finalAmount = enrollment.totalAmount - discountAmount;

              return (
                <div 
                  key={enrollment.classId}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  {/* Class Name with Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{enrollment.className}</h4>
                      {isWinnerClass && (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{enrollment.sessionsCount} sessions</span>
                  </div>

                  {/* Base Tuition */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Base Tuition</span>
                    <span className="text-base font-medium">{formatVND(enrollment.totalAmount)}</span>
                  </div>

                  {/* Discount (only for winner) */}
                  {isWinnerClass && (
                    <div className="flex items-center justify-between py-2 -mt-1">
                      <span className="text-sm text-green-600 dark:text-green-400">Discount ({discountPercent}%)</span>
                      <span className="text-base font-medium text-green-600 dark:text-green-400">
                        -{formatVND(discountAmount)}
                      </span>
                    </div>
                  )}

                  {/* Final Payable */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-sm font-semibold">Final Payable</span>
                    <span className={`text-lg font-bold ${isWinnerClass ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                      {formatVND(finalAmount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-green-200 dark:border-green-800">
          <p className="text-xs text-muted-foreground">
            Sibling discount applies only to the highest tuition class. Other classes are charged at full rate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
