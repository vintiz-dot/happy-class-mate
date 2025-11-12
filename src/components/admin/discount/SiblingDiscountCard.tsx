import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingDown } from "lucide-react";
import { formatVND } from "@/hooks/useStudentMonthFinance";

interface SiblingDiscountCardProps {
  studentId: string;
  month?: string;
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
        .select(`
          *,
          winner_class:classes!sibling_discount_state_winner_class_id_fkey(id, name, session_rate_vnd)
        `)
        .eq("family_id", student.family_id)
        .eq("month", currentMonth)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!student?.family_id,
  });

  // Get per-class tuition breakdown for this student
  const { data: classBreakdown } = useQuery({
    queryKey: ["student-class-breakdown", studentId, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-tuition', {
        body: { studentId, month: currentMonth }
      });
      if (error) throw error;
      return data?.sessionDetails || [];
    },
    enabled: !!studentId && !!siblingState?.winner_class_id,
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
        </CardContent>
      </Card>
    );
  }

  // This student is the winner - calculate discount details
  const winnerClass = Array.isArray(siblingState.winner_class) 
    ? siblingState.winner_class[0] 
    : siblingState.winner_class;

  const classBase = siblingState.projected_base_snapshot || 0;
  const discountPercent = siblingState.sibling_percent || 0;
  const discountAmount = Math.round(classBase * (discountPercent / 100));
  const finalPayable = classBase - discountAmount;

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <CardTitle className="text-green-700 dark:text-green-300">Sibling Discount Active</CardTitle>
            <CardDescription>
              {discountPercent}% discount applied to {winnerClass?.name || 'selected class'}
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Winner
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div>
              <p className="text-sm font-medium">Class</p>
              <p className="text-xs text-muted-foreground">Applied to this enrollment</p>
            </div>
            <p className="text-lg font-semibold">{winnerClass?.name || 'Unknown'}</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div>
              <p className="text-sm font-medium">Total Fee</p>
              <p className="text-xs text-muted-foreground">Before discount</p>
            </div>
            <p className="text-lg font-semibold">{formatVND(classBase)}</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-800">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Discount ({discountPercent}%)</p>
                <p className="text-xs text-green-600 dark:text-green-400">Sibling benefit</p>
              </div>
            </div>
            <p className="text-lg font-semibold text-green-700 dark:text-green-300">-{formatVND(discountAmount)}</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border-2 border-primary">
            <div>
              <p className="text-sm font-medium">Final Payable</p>
              <p className="text-xs text-muted-foreground">After discount</p>
            </div>
            <p className="text-xl font-bold text-primary">{formatVND(finalPayable)}</p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            This discount applies only to <span className="font-medium text-foreground">{winnerClass?.name}</span>. 
            Other enrollments are charged at full rate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
