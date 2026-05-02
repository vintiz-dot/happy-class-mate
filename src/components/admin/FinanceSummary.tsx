import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, UserX, CheckCircle } from "lucide-react";
import { useFinanceSummary } from "@/hooks/useFinanceSummary";
import { MonthPicker } from "@/components/MonthPicker";
import { dayjs } from "@/lib/date";

const EARLIEST_FINANCE_MONTH = "2025-10";

export function FinanceSummary() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: summary, isLoading } = useFinanceSummary(selectedMonth);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Finance Summary</h2>
        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
          minMonth={EARLIEST_FINANCE_MONTH}
          maxMonth={dayjs().add(2, "month").format("YYYY-MM")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <CardTitle className="text-sm font-medium">Collection</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatVND(summary?.totalCollected || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "..." : `${summary?.collectionRate || 0}% of billed tuition`}
            </p>
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
            <CardTitle className="text-sm font-medium">Expenditures & Losses</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatVND((summary?.totalExpenditures || 0) + (summary?.excusedLoss || 0))}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
              <p>Operating: {isLoading ? "..." : formatVND(summary?.totalExpenditures || 0)}</p>
              <p className="text-amber-600">Excused loss: {isLoading ? "..." : formatVND(summary?.excusedLoss || 0)}</p>
            </div>
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
