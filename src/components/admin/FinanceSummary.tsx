import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export function FinanceSummary() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["finance-summary", selectedMonth],
    queryFn: async () => {
      const startDate = `${selectedMonth}-01`;
      const nextMonth = new Date(startDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = format(nextMonth, "yyyy-MM-dd");

      // Total tuition billed - fetch gross, discounts, and net
      const { data: invoices } = await supabase
        .from("invoices")
        .select("base_amount, discount_amount, total_amount")
        .eq("month", selectedMonth);

      const grossTuition = (invoices || []).reduce((sum, inv) => sum + (inv.base_amount || 0), 0);
      const totalDiscounts = (invoices || []).reduce((sum, inv) => sum + (inv.discount_amount || 0), 0);
      const totalTuition = (invoices || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      // Total teacher salary - use calculate-payroll for accurate actual vs projected
      const { data: payrollResult, error: payrollError } = await supabase.functions.invoke("calculate-payroll", {
        body: { month: selectedMonth },
      });

      const totalSalaryActual = payrollError ? 0 : (payrollResult?.grandTotalActual || 0);
      const totalSalaryProjected = payrollError ? 0 : (payrollResult?.grandTotalProjected || 0);

      // Total expenditures
      const { data: expenditures } = await supabase
        .from("expenditures")
        .select("amount")
        .gte("date", startDate)
        .lt("date", endDate);

      const totalExpenditures = (expenditures || []).reduce((sum, e) => sum + (e.amount || 0), 0);

      const netActual = totalTuition - totalSalaryActual - totalExpenditures;
      const netProjected = totalTuition - totalSalaryProjected - totalExpenditures;

      return {
        grossTuition,
        totalDiscounts,
        totalTuition,
        totalSalaryActual,
        totalSalaryProjected,
        totalExpenditures,
        netActual,
        netProjected,
      };
    },
  });

  // Set up real-time listeners
  useEffect(() => {
    const startDate = `${selectedMonth}-01`;
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = format(nextMonth, "yyyy-MM-dd");

    const invoicesChannel = supabase
      .channel("invoices-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
          filter: `month=eq.${selectedMonth}`,
        },
        () => {
          // Invalidate query on changes
          queryClient.invalidateQueries({ queryKey: ["finance-summary", selectedMonth] });
        }
      )
      .subscribe();

    const payrollChannel = supabase
      .channel("payroll-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payroll_summaries",
          filter: `month=eq.${selectedMonth}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["finance-summary", selectedMonth] });
        }
      )
      .subscribe();

    const expendituresChannel = supabase
      .channel("expenditures-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenditures",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["finance-summary", selectedMonth] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(payrollChannel);
      supabase.removeChannel(expendituresChannel);
    };
  }, [selectedMonth]);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = -6; i <= 2; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      options.push({ value, label });
    }
    return options;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Finance Summary</h2>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getMonthOptions().map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tuition Billed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatVND(summary?.totalTuition || 0)}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
              <p>Gross: {isLoading ? "..." : formatVND(summary?.grossTuition || 0)}</p>
              <p>Discounts: {isLoading ? "..." : `-${formatVND(summary?.totalDiscounts || 0)}`}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teacher Salary</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatVND(summary?.totalSalaryActual || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Actual: {isLoading ? "..." : formatVND(summary?.totalSalaryActual || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Projected: {isLoading ? "..." : formatVND(summary?.totalSalaryProjected || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenditures</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatVND(summary?.totalExpenditures || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Operating costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.netActual || 0) < 0 ? "text-destructive" : "text-success"}`}>
              {isLoading ? "..." : formatVND(summary?.netActual || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Actual: {isLoading ? "..." : formatVND(summary?.netActual || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Projected: {isLoading ? "..." : formatVND(summary?.netProjected || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
