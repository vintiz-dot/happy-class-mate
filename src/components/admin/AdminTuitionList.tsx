import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TuitionPageFilters } from "@/components/admin/TuitionPageFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, DollarSign, ArrowUpDown, AlertCircle, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { dayjs } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPaymentStatus, getTuitionStatusBadge } from "@/lib/tuitionStatus";
import { RecordPaymentDialog } from "@/components/admin/RecordPaymentDialog";

interface AdminTuitionListProps {
  month: string;
}

export const AdminTuitionList = ({ month }: AdminTuitionListProps) => {
  const [sortBy, setSortBy] = useState<"name" | "balance" | "total" | "class">("name");
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmationFilter, setConfirmationFilter] = useState<string>("all");
  const [paymentItem, setPaymentItem] = useState<any>(null);
  const navigate = useNavigate();

  const { data: tuitionData, isLoading } = useQuery({
    queryKey: ["admin-tuition-list", month],
    queryFn: async () => {
      const monthStart = `${month}-01`;
      const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
        .toISOString()
        .slice(0, 10);

      const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name, family_id, is_active")
        .eq("is_active", true);

      if (studentsError) throw studentsError;
      if (!allStudents || allStudents.length === 0) return [];

      const allStudentIds = allStudents.map((s) => s.id);

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`student_id, class_id, classes(id, name)`)
        .in("student_id", allStudentIds)
        .lte("start_date", monthEnd)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("month", month)
        .in("student_id", allStudentIds);

      const { data: discounts } = await supabase
        .from("discount_assignments")
        .select("student_id, discount_def_id")
        .lte("effective_from", monthEnd)
        .or(`effective_to.is.null,effective_to.gte.${monthStart}`);

      const studentDiscounts = new Set(discounts?.map((d) => d.student_id) || []);

      const { data: students } = await supabase.from("students").select("id, family_id").eq("is_active", true);

      const familyCounts = new Map<string, number>();
      students?.forEach((s) => {
        if (s.family_id) {
          familyCounts.set(s.family_id, (familyCounts.get(s.family_id) || 0) + 1);
        }
      });

      const siblingStudents = new Set(
        students?.filter((s) => s.family_id && (familyCounts.get(s.family_id) || 0) >= 2).map((s) => s.id) || [],
      );

      const studentClasses = new Map<string, any[]>();
      enrollments?.forEach((e: any) => {
        const existing = studentClasses.get(e.student_id) || [];
        if (e.classes) {
          existing.push(Array.isArray(e.classes) ? e.classes[0] : e.classes);
        }
        studentClasses.set(e.student_id, existing);
      });

      const invoiceMap = new Map(invoices?.map((inv) => [inv.student_id, inv]) || []);

      const { data: priorInvoices } = await supabase
        .from("invoices")
        .select("student_id, total_amount, recorded_payment")
        .lt("month", month)
        .in("student_id", allStudentIds);

      const priorBalanceMap = new Map<string, number>();
      priorInvoices?.forEach((inv) => {
        const currentBalance = priorBalanceMap.get(inv.student_id) || 0;
        priorBalanceMap.set(inv.student_id, currentBalance + (inv.recorded_payment || 0) - (inv.total_amount || 0));
      });

      return allStudents.map((student) => {
        const invoice = invoiceMap.get(student.id);
        const currentCharges = invoice?.total_amount || 0;
        const carryInCredit = invoice?.carry_in_credit || 0;
        const carryInDebt = invoice?.carry_in_debt || 0;
        const priorBalance = priorBalanceMap.get(student.id) || 0;
        const finalPayable = currentCharges + carryInDebt - carryInCredit;
        const recordedPayment = invoice?.recorded_payment || 0;
        const carryOutCredit = Math.max(0, recordedPayment - finalPayable);
        const carryOutDebt = Math.max(0, finalPayable - recordedPayment);

        return {
          id: invoice?.id || `placeholder-${student.id}`,
          student_id: student.id,
          month,
          base_amount: invoice?.base_amount || 0,
          discount_amount: invoice?.discount_amount || 0,
          total_amount: currentCharges,
          paid_amount: invoice?.paid_amount || 0,
          recorded_payment: recordedPayment,
          status: invoice?.status || "open",
          students: student,
          hasDiscount: studentDiscounts.has(student.id),
          hasSiblings: siblingStudents.has(student.id),
          priorBalance,
          finalPayable,
          balance: finalPayable - recordedPayment,
          classes: studentClasses.get(student.id) || [],
          carry_out_credit: invoice?.carry_out_credit ?? carryOutCredit,
          carry_out_debt: invoice?.carry_out_debt ?? carryOutDebt,
          carry_in_credit: carryInCredit,
          carry_in_debt: carryInDebt,
        };
      });
    },
  });

  const filterChips = useMemo(() => {
    if (!tuitionData) return [];
    const withDiscount = tuitionData.filter((i: any) => i.hasDiscount).length;
    const withSiblings = tuitionData.filter((i: any) => i.hasSiblings).length;
    const getStatus = (item: any) => getPaymentStatus({
      carryOutDebt: item.carry_out_debt ?? 0,
      carryOutCredit: item.carry_out_credit ?? 0,
      totalAmount: item.total_amount ?? 0,
      monthPayments: item.recorded_payment ?? 0,
    });
    const overpaid = tuitionData.filter((i: any) => getStatus(i) === 'overpaid').length;
    const settled = tuitionData.filter((i: any) => getStatus(i) === 'settled').length;
    const underpaid = tuitionData.filter((i: any) => getStatus(i) === 'underpaid').length;
    const paid = settled + overpaid;

    return [
      { key: "all", label: "All", count: tuitionData.length },
      { key: "discount", label: "Discount", count: withDiscount },
      { key: "no-discount", label: "No Discount", count: tuitionData.length - withDiscount },
      { key: "siblings", label: "Siblings", count: withSiblings },
      { key: "paid", label: "Paid", count: paid },
      { key: "overpaid", label: "Overpaid", count: overpaid },
      { key: "underpaid", label: "Underpaid", count: underpaid },
      { key: "settled", label: "Settled", count: settled },
    ];
  }, [tuitionData]);

  const filteredAndSortedData = useMemo(() => {
    if (!tuitionData) return [];
    const getStatus = (item: any) => getPaymentStatus({
      carryOutDebt: item.carry_out_debt ?? 0,
      carryOutCredit: item.carry_out_credit ?? 0,
      totalAmount: item.total_amount ?? 0,
      monthPayments: item.recorded_payment ?? 0,
    });

    let filtered = tuitionData;
    if (activeFilter !== "all") {
      filtered = tuitionData.filter((item: any) => {
        const status = getStatus(item);
        switch (activeFilter) {
          case "discount": return item.hasDiscount;
          case "no-discount": return !item.hasDiscount;
          case "siblings": return item.hasSiblings;
          case "paid": return status === 'settled' || status === 'overpaid';
          case "overpaid": return status === 'overpaid';
          case "underpaid": return status === 'underpaid';
          case "settled": return status === 'settled';
          default: return true;
        }
      });
    }

    if (confirmationFilter !== "all") {
      filtered = filtered.filter((item: any) => item.confirmation_status === confirmationFilter);
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return ((a.students as any)?.full_name || "").localeCompare((b.students as any)?.full_name || "");
        case "balance":
          return Math.abs(b.balance) - Math.abs(a.balance);
        case "total":
          return b.total_amount - a.total_amount;
        case "class":
          return ((a as any).classes?.[0]?.name || "").localeCompare((b as any).classes?.[0]?.name || "");
        default:
          return 0;
      }
    });
  }, [tuitionData, sortBy, activeFilter, confirmationFilter]);

  const getStatusBadge = (item: any) => {
    const status = getPaymentStatus({
      carryOutDebt: item.carry_out_debt ?? 0,
      carryOutCredit: item.carry_out_credit ?? 0,
      totalAmount: item.total_amount ?? 0,
      monthPayments: item.recorded_payment ?? 0,
    });
    return getTuitionStatusBadge(status);
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading tuition data...</p>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tuition Overview - {dayjs(month).format("MMMM YYYY")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/tuition-review?month=${month}`)}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Review Queue
              {tuitionData?.filter((i: any) => i.confirmation_status === 'needs_review').length > 0 && (
                <Badge variant="destructive">
                  {tuitionData?.filter((i: any) => i.confirmation_status === 'needs_review').length}
                </Badge>
              )}
            </Button>

            <Select value={confirmationFilter} onValueChange={setConfirmationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Confirmations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confirmations</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="auto_approved">Auto Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TuitionPageFilters
            filters={filterChips}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sort by:</span>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="total">Total Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredAndSortedData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tuition records found</p>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedData.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{(item.students as any)?.full_name}</p>
                      {getStatusBadge(item)}
                      {item.hasDiscount && <Badge variant="outline">Discount</Badge>}
                      {item.hasSiblings && <Badge variant="outline">Sibling</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {(item as any).classes?.length > 0 && (
                        <span className="font-medium">{(item as any).classes.map((c: any) => c.name).join(", ")}</span>
                      )}
                      <span>Base: {item.base_amount.toLocaleString()} ₫</span>
                      <span>Discount: -{item.discount_amount.toLocaleString()} ₫</span>
                      <span>Current: {item.total_amount.toLocaleString()} ₫</span>
                      <span className={item.priorBalance >= 0 ? "text-success" : "text-destructive"}>
                        Prior: {item.priorBalance >= 0 ? "+" : ""}{item.priorBalance.toLocaleString()} ₫
                      </span>
                      <span className="font-semibold text-primary">Payable: {item.finalPayable.toLocaleString()} ₫</span>
                      <span>Paid: {(item.recorded_payment ?? item.paid_amount).toLocaleString()} ₫</span>
                      {item.balance !== 0 && (
                        <span className={item.balance > 0 ? "text-destructive" : "text-primary"}>
                          Balance: {item.balance.toLocaleString()} ₫
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setPaymentItem(item)}
                      className="gap-1"
                    >
                      <CreditCard className="h-4 w-4" />
                      Record Pay
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/students/${item.student_id}`)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        open={!!paymentItem}
        onClose={() => setPaymentItem(null)}
        item={paymentItem}
        month={month}
      />
    </>
  );
};
