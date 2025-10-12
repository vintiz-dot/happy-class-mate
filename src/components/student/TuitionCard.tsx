import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingDown, Award } from "lucide-react";
import { format } from "date-fns";

interface TuitionData {
  baseAmount: number;
  discounts: Array<{
    name: string;
    type: string;
    value: number;
    amount: number;
    isSiblingWinner?: boolean;
  }>;
  totalDiscount: number;
  totalAmount: number;
  sessionCount: number;
}

export function TuitionCard({ studentId }: { studentId: string }) {
  const [currentMonth, setCurrentMonth] = useState<TuitionData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (studentId) {
      loadTuition();
    }
  }, [studentId]);

  const loadTuition = async () => {
    try {
      setLoading(true);
      const month = format(new Date(), "yyyy-MM");

      const { data, error } = await supabase.functions.invoke("calculate-tuition", {
        body: { studentId, month },
      });

      if (error) throw error;
      setCurrentMonth(data);
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tuition</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!currentMonth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tuition</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No tuition data available</p>
        </CardContent>
      </Card>
    );
  }

  const siblingDiscount = currentMonth.discounts.find(d => d.isSiblingWinner);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Tuition - {format(new Date(), "MMMM yyyy")}
        </CardTitle>
        <CardDescription>{currentMonth.sessionCount} sessions this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {siblingDiscount && (
          <div className="p-3 bg-primary/10 rounded-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">
              Sibling Discount Recipient ({siblingDiscount.value}%)
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Base Amount</span>
            <span className="font-medium">{currentMonth.baseAmount.toLocaleString('vi-VN')} ₫</span>
          </div>

          {currentMonth.discounts.length > 0 && (
            <>
              <div className="flex items-start justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Discounts</span>
                </div>
                <div className="text-right space-y-1">
                  {currentMonth.discounts.map((discount, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground">
                      {discount.name}: -{discount.amount.toLocaleString('vi-VN')} ₫
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {discount.value}{discount.type === 'percent' ? '%' : ' ₫'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Total Discount</span>
                <span className="font-medium text-success">
                  -{currentMonth.totalDiscount.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </>
          )}

          <div className="flex items-center justify-between text-lg font-bold border-t-2 pt-3">
            <span>Total Due</span>
            <span className="text-primary">{currentMonth.totalAmount.toLocaleString('vi-VN')} ₫</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
