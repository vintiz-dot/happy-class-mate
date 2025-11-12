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
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["student-enrollments-tuition", studentId, currentMonth],
    queryFn: async () => {
      // Fetch enrollments - explicitly typed to avoid deep type instantiation
      const enrollQuery = await (supabase as any)
        .from("enrollments")
        .select("id, class_id")
        .eq("student_id", studentId);

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

      // For each enrollment, count sessions in the given month
      const classTuitions: ClassTuition[] = await Promise.all(
        enrollData.map(async (enrollment: any) => {
          const classInfo = classData?.find((c: any) => c.id === enrollment.class_id);
          
          // Count sessions for this class in the given month
          const startDate = `${currentMonth}-01`;
          const endDate = `${currentMonth}-31`;
          
          const sessionQuery = await (supabase as any)
            .from("sessions")
            .select("id")
            .eq("class_id", enrollment.class_id)
            .gte("date", startDate)
            .lte("date", endDate)
            .neq("status", "Canceled");

          const { data: sessions, error: sessionError } = sessionQuery;

          if (sessionError) console.error("Session fetch error:", sessionError);
          
          const sessionsCount = sessions?.length || 0;
          const totalAmount = sessionsCount * (classInfo?.session_rate_vnd || 0);

          return {
            classId: enrollment.class_id || '',
            className: classInfo?.name || 'Unknown',
            sessionsCount,
            totalAmount,
          };
        })
      );

      return classTuitions;
    },
    enabled: !!studentId,
  });

  if (isLoading || enrollmentsLoading) {
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

  // Determine if this student is the discount winner
  const isWinner = siblingState?.status === 'assigned' && siblingState.winner_student_id === studentId;
  const discountPercent = siblingState?.sibling_percent || 0;
  
  // Find the highest tuition class to apply discount (winner class)
  const winnerClass = enrollments && enrollments.length > 0
    ? enrollments.reduce((max, current) => current.totalAmount > max.totalAmount ? current : max)
    : null;

  // No sibling discount scenario
  if (!siblingState || siblingState.status === 'none') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Sibling Discount</CardTitle>
          </div>
          <CardDescription>
            Not eligible (requires ≥2 students in family)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments && enrollments.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Monthly Tuition Breakdown</p>
              {enrollments.map(enrollment => (
                <div key={enrollment.classId} className="p-4 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{enrollment.className}</h4>
                    <span className="text-xs text-muted-foreground">{enrollment.sessionsCount} sessions</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Total Payable</span>
                    <span className="text-lg font-bold">{formatVND(enrollment.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Calculate grand totals
  const grandTotal = enrollments?.reduce((sum, e) => sum + e.totalAmount, 0) || 0;
  const totalDiscount = isWinner && winnerClass
    ? Math.round(winnerClass.totalAmount * (discountPercent / 100))
    : 0;
  const grandFinalPayable = grandTotal - totalDiscount;

  return (
    <Card className={isWinner ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : ""}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className={`h-5 w-5 ${isWinner ? 'text-green-600 dark:text-green-400' : ''}`} />
          <div className="flex-1">
            <CardTitle className={isWinner ? "text-green-700 dark:text-green-300" : ""}>
              {isWinner ? 'Sibling Discount Active' : 'Sibling Discount Status'}
            </CardTitle>
            <CardDescription>
              {isWinner 
                ? `${discountPercent}% discount applied to highest tuition class`
                : siblingState?.status === 'assigned' 
                ? 'Sibling receives the discount this month'
                : 'Threshold not met for this month'}
            </CardDescription>
          </div>
          {isWinner && (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              Winner
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isWinner && siblingState?.reason && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">{siblingState.reason}</p>
          </div>
        )}

        {enrollments && enrollments.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Monthly Tuition Breakdown</p>
            
            {enrollments.map(enrollment => {
              const isWinnerClass = isWinner && winnerClass?.classId === enrollment.classId;
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

                  {/* Discount (only for winner class) */}
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

            {/* Grand Total Summary */}
            <div className="p-4 rounded-lg border-2 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Before Discount</span>
                <span className="text-base font-semibold">{formatVND(grandTotal)}</span>
              </div>
              {isWinner && totalDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Total Discount</span>
                  <span className="text-base font-semibold text-green-600 dark:text-green-400">
                    -{formatVND(totalDiscount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold">Grand Total Payable</span>
                <span className={`text-xl font-bold ${isWinner ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {formatVND(grandFinalPayable)}
                </span>
              </div>
            </div>
          </div>
        )}

        {isWinner && (
          <div className="pt-2 border-t border-green-200 dark:border-green-800">
            <p className="text-xs text-muted-foreground">
              Sibling discount applies only to the highest tuition class. Other classes are charged at full rate.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
