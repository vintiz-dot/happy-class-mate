import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Award, DollarSign, CheckCircle2 } from "lucide-react";
import { useStudentMonthFinance, formatVND, getMonthOptions } from "@/hooks/useStudentMonthFinance";
import { InvoiceDownloadButton } from "@/components/invoice/InvoiceDownloadButton";
import { TuitionPageFilters } from "@/components/admin/TuitionPageFilters";
import { checkStudentFinanceParity } from "@/lib/dev/parityCheck";
import { SettleBillModal } from "@/components/admin/SettleBillModal";
import { useAuth } from "@/hooks/useAuth";

export function StudentTuitionTab({ studentId }: { studentId: string }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeFilter, setActiveFilter] = useState("all");
  const [settleBillOpen, setSettleBillOpen] = useState(false);
  const [studentName, setStudentName] = useState("");

  const queryClient = useQueryClient();
  const { session } = useAuth();
  
  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const checkAdmin = async () => {
      if (!session?.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    };
    checkAdmin();
  }, [session]);

  // Load student name
  useEffect(() => {
    const loadStudentName = async () => {
      const { data } = await supabase
        .from("students")
        .select("full_name")
        .eq("id", studentId)
        .single();
      if (data) setStudentName(data.full_name);
    };
    loadStudentName();
  }, [studentId]);

  // Fetch invoice data - same as PDF download
  const { data: tuitionData, isLoading } = useStudentMonthFinance(studentId, selectedMonth);

  // Real-time sync - invalidate on changes
  useEffect(() => {
    const paymentsChannel = supabase
      .channel("student-payments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student-month-finance", studentId] });
        }
      )
      .subscribe();

    const invoicesChannel = supabase
      .channel("student-invoices-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student-month-finance", studentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(invoicesChannel);
    };
  }, [studentId, queryClient]);

  // Dev-only parity check - compare Admin vs Student data
  useEffect(() => {
    if (import.meta.env.DEV && tuitionData) {
      checkStudentFinanceParity(studentId, selectedMonth, {
        cumulativePaidAmount: tuitionData.cumulativePaidAmount,
        totalAmount: tuitionData.totalAmount,
        baseAmount: tuitionData.baseAmount,
        totalDiscount: tuitionData.totalDiscount,
        balance: tuitionData.balance,
      });
    }
  }, [tuitionData, studentId, selectedMonth]);

  // Generate filter chips with counts - match Admin Finance
  const filterChips = useMemo(() => {
    if (!tuitionData) return [];
    
    const hasDiscount = (tuitionData.totalDiscount ?? 0) > 0;
    const hasSibling = tuitionData.siblingState?.status === 'assigned' && tuitionData.siblingState?.isWinner;
    const isPaid = tuitionData.cumulativePaidAmount >= tuitionData.totalAmount && tuitionData.totalAmount > 0;
    const isOverpaid = tuitionData.cumulativePaidAmount > tuitionData.totalAmount;
    const isUnderpaid = tuitionData.cumulativePaidAmount < tuitionData.totalAmount && tuitionData.cumulativePaidAmount > 0;
    const isSettled = tuitionData.balanceStatus === 'settled' && tuitionData.totalAmount > 0;

    return [
      { key: "all", label: "All", count: 1 },
      { key: "discount", label: "Discount", count: hasDiscount ? 1 : 0 },
      { key: "no-discount", label: "No Discount", count: !hasDiscount ? 1 : 0 },
      { key: "siblings", label: "Siblings", count: hasSibling ? 1 : 0 },
      { key: "paid", label: "Paid", count: isPaid ? 1 : 0 },
      { key: "overpaid", label: "Overpaid", count: isOverpaid ? 1 : 0 },
      { key: "underpaid", label: "Underpaid", count: isUnderpaid ? 1 : 0 },
      { key: "settled", label: "Settled", count: isSettled ? 1 : 0 },
    ];
  }, [tuitionData]);

  // Status badge - match Admin Finance exactly
  const getStatusBadge = () => {
    if (!tuitionData) return null;
    
    // Use carry-out balance to determine status
    const carryOutDebt = tuitionData.carryOutDebt;
    const carryOutCredit = tuitionData.carryOutCredit;
    
    if (carryOutCredit > 0) {
      return <Badge className="bg-blue-500">Overpaid</Badge>;
    }
    if (carryOutDebt === 0 && carryOutCredit === 0 && tuitionData.totalAmount > 0) {
      return <Badge className="bg-green-500">Settled</Badge>;
    }
    if (tuitionData.monthPayments > 0 && carryOutDebt > 0) {
      return <Badge variant="outline">Underpaid</Badge>;
    }
    if (carryOutDebt > 0) {
      return <Badge variant="destructive">Unpaid</Badge>;
    }
    return <Badge variant="secondary">Open</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-12 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!tuitionData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No tuition data available for this month</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Selector and Filters - Match Admin Finance */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <h2 className="text-2xl font-bold">Tuition Overview</h2>
          </div>
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

        {/* Filter Chips - Match Admin Finance */}
        <TuitionPageFilters
          filters={filterChips}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* Status and Invoice - Match Admin Finance */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {tuitionData.totalDiscount > 0 && (
            <Badge variant="outline">Discount Applied</Badge>
          )}
          {tuitionData.siblingState?.status === 'assigned' && tuitionData.siblingState?.isWinner && (
            <Badge variant="secondary" className="gap-1">
              <Award className="h-3 w-3" />
              Sibling {tuitionData.siblingState.percent}%
              {tuitionData.siblingState.winnerClassId && ' (1 class)'}
            </Badge>
          )}
          {tuitionData.siblingState?.status === 'pending' && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              Sibling Pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && ((tuitionData?.carryOutDebt ?? 0) > 0 || (tuitionData?.carryOutCredit ?? 0) > 0) && (
            <Button
              onClick={() => setSettleBillOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Settle Bill
            </Button>
          )}
          <InvoiceDownloadButton 
            studentId={studentId} 
            month={selectedMonth}
            variant="default"
            size="sm"
          />
        </div>
      </div>

      {/* Financial Summary Cards - Match Admin Finance column order */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tuitionData.sessionCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Base Tuition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatVND(tuitionData.baseAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Before discounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Discounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              -{formatVND(tuitionData.totalDiscount)}
            </p>
            {tuitionData.discounts && tuitionData.discounts.length > 0 && (
              <div className="mt-2 space-y-1">
                {tuitionData.discounts.map((d, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {d.name}: -{formatVND(d.amount)}
                    {d.isSiblingWinner && d.appliedToClass && (
                      <span className="text-[10px] block text-primary">
                        Applied to one class only
                      </span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatVND(tuitionData.totalAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This month only
            </p>
          </CardContent>
        </Card>

        <Card className={tuitionData.carryInDebt > 0 ? 'bg-destructive/5' : tuitionData.carryInCredit > 0 ? 'bg-success/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prior Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${
              tuitionData.carryInDebt > 0 ? 'text-destructive' : 
              tuitionData.carryInCredit > 0 ? 'text-success' : ''
            }`}>
              {tuitionData.carryInCredit > 0 
                ? `+${formatVND(tuitionData.carryInCredit)}`
                : tuitionData.carryInDebt > 0
                  ? `-${formatVND(tuitionData.carryInDebt)}`
                  : formatVND(0)
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {tuitionData.carryInCredit > 0 ? 'Credit from prior months' : 
               tuitionData.carryInDebt > 0 ? 'Debt from prior months' : 'No carry-over'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status - Match Admin Finance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Final Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatVND(tuitionData.totalAmount + (tuitionData.carryInDebt - tuitionData.carryInCredit))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current + Prior Balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recorded Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatVND(tuitionData.monthPayments)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Paid this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${
              tuitionData.carryOutDebt > 0 ? 'text-destructive' : 
              tuitionData.carryOutCredit > 0 ? 'text-green-600' : ''
            }`}>
              {formatVND(tuitionData.carryOutDebt > 0 ? tuitionData.carryOutDebt : tuitionData.carryOutCredit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {tuitionData.carryOutCredit > 0 && 'Overpaid - Credit'}
              {tuitionData.carryOutDebt > 0 && 'Amount Due'}
              {tuitionData.carryOutDebt === 0 && tuitionData.carryOutCredit === 0 && 'Fully Settled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {tuitionData.balanceStatus === 'settled' ? 'All paid up' : tuitionData.balanceStatus === 'credit' ? 'Overpaid for this month' : 'Outstanding balance'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Session Details - Match Admin display */}
      {tuitionData.sessionDetails && tuitionData.sessionDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tuitionData.sessionDetails.map((session, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {new Date(session.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {session.status}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatVND(session.rate)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settle Bill Modal */}
      {isAdmin && (
        <SettleBillModal
          studentId={settleBillOpen ? studentId : null}
          studentName={studentName}
          month={selectedMonth}
          balance={tuitionData?.carryOutDebt ?? tuitionData?.carryOutCredit ?? 0}
          onClose={() => setSettleBillOpen(false)}
        />
      )}
    </div>
  );
}