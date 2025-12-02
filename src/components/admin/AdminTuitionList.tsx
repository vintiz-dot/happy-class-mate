import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TuitionPageFilters } from "@/components/admin/TuitionPageFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, DollarSign, ArrowUpDown, Settings, Save, X, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { dayjs } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";

const PaymentSchema = z.object({
  amount: z.number().min(0, "Amount must be positive").max(100000000, "Amount too large"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  method: z.enum(["Cash", "Bank Transfer", "Card", "Other"], {
    errorMap: () => ({ message: "Invalid payment method" }),
  }),
});

interface AdminTuitionListProps {
  month: string;
}

export const AdminTuitionList = ({ month }: AdminTuitionListProps) => {
  const [sortBy, setSortBy] = useState<"name" | "balance" | "total" | "class">("name");
  const [confirmationFilter, setConfirmationFilter] = useState<string>("all");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState("Cash");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tuitionData, isLoading } = useQuery({
    queryKey: ["admin-tuition-list", month],
    queryFn: async () => {
      const monthStart = `${month}-01`;
      const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
        .toISOString()
        .slice(0, 10);

      // Fetch ALL active students first
      const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name, family_id, is_active")
        .eq("is_active", true);

      if (studentsError) throw studentsError;
      if (!allStudents || allStudents.length === 0) return [];

      const allStudentIds = allStudents.map((s) => s.id);

      // Fetch enrollments for ALL active students
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(
          `
          student_id,
          class_id,
          classes(id, name)
        `,
        )
        .in("student_id", allStudentIds)
        .lte("start_date", monthEnd)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);

      // Fetch invoices for ALL active students
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("month", month)
        .in("student_id", allStudentIds);

      // Fetch discount assignments
      const { data: discounts } = await supabase
        .from("discount_assignments")
        .select("student_id, discount_def_id")
        .lte("effective_from", monthEnd)
        .or(`effective_to.is.null,effective_to.gte.${monthStart}`);

      const studentDiscounts = new Set(discounts?.map((d) => d.student_id) || []);

      // Get families with multiple students
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

      // Map student to classes
      const studentClasses = new Map<string, any[]>();

      enrollments?.forEach((e: any) => {
        const existing = studentClasses.get(e.student_id) || [];
        if (e.classes) {
          existing.push(Array.isArray(e.classes) ? e.classes[0] : e.classes);
        }
        studentClasses.set(e.student_id, existing);
      });

      // Create invoice map for quick lookup
      const invoiceMap = new Map(invoices?.map((inv) => [inv.student_id, inv]) || []);

      // Fetch prior invoices to calculate carry-in balance
      const { data: priorInvoices } = await supabase
        .from("invoices")
        .select("student_id, total_amount, recorded_payment")
        .lt("month", month)
        .in("student_id", allStudentIds);

      // Calculate prior balance for each student (prior payments - prior charges)
      const priorBalanceMap = new Map<string, number>();
      priorInvoices?.forEach((inv) => {
        const currentBalance = priorBalanceMap.get(inv.student_id) || 0;
        priorBalanceMap.set(inv.student_id, currentBalance + (inv.recorded_payment || 0) - (inv.total_amount || 0));
      });

      // Build tuition data for ALL active students
      return allStudents.map((student) => {
        const invoice = invoiceMap.get(student.id);
        const currentCharges = invoice?.total_amount || 0;
        
        // Use invoice carry values if available, else calculate from prior invoices
        const carryInCredit = invoice?.carry_in_credit || 0;
        const carryInDebt = invoice?.carry_in_debt || 0;
        const priorBalance = priorBalanceMap.get(student.id) || 0;
        const finalPayable = currentCharges + carryInDebt - carryInCredit;

        return {
          id: invoice?.id || `placeholder-${student.id}`,
          student_id: student.id,
          month: month,
          base_amount: invoice?.base_amount || 0,
          discount_amount: invoice?.discount_amount || 0,
          total_amount: currentCharges,
          paid_amount: invoice?.paid_amount || 0,
          recorded_payment: invoice?.recorded_payment || 0,
          status: invoice?.status || "open",
          students: student,
          hasDiscount: studentDiscounts.has(student.id),
          hasSiblings: siblingStudents.has(student.id),
          priorBalance: priorBalance, // Prior payments - prior charges
          finalPayable: finalPayable, // Current charges + prior balance
          balance: finalPayable - (invoice?.recorded_payment || 0), // Outstanding after current payment
          classes: studentClasses.get(student.id) || [],
        };
      });
    },
  });

  const filteredAndSortedData = useMemo(() => {
    if (!tuitionData) return [];

    // Apply confirmation filter
    let filtered = tuitionData;
    if (confirmationFilter !== "all") {
      filtered = tuitionData.filter((item: any) => 
        item.confirmation_status === confirmationFilter
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return ((a.students as any)?.full_name || "").localeCompare((b.students as any)?.full_name || "");
        case "balance":
          return Math.abs(b.balance) - Math.abs(a.balance);
        case "total":
          return b.total_amount - a.total_amount;
        case "class":
          const aClass = (a as any).classes?.[0]?.name || "";
          const bClass = (b as any).classes?.[0]?.name || "";
          return aClass.localeCompare(bClass);
        default:
          return 0;
      }
    });

    return sorted;
  }, [tuitionData, sortBy, confirmationFilter]);

  const handleStartEdit = (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    const balance = invoice.total_amount - (invoice.recorded_payment ?? 0);
    setEditValue(String(balance > 0 ? balance : 0));
    setEditDate(new Date().toISOString().split("T")[0]);
    setEditMethod("Cash");
  };

  const handleCancelEdit = () => {
    setEditingInvoiceId(null);
    setEditValue("");
    setEditDate("");
    setEditMethod("Cash");
  };

  const handleSaveEdit = async (invoice: any) => {
    const newValue = parseInt(editValue) || 0;

    // Validate input using zod schema
    const validation = PaymentSchema.safeParse({
      amount: newValue,
      date: editDate,
      method: editMethod,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Determine new status based on payment
      let newStatus = invoice.status;
      const totalAmount = invoice.total_amount;

      if (newValue === 0 && totalAmount === 0) {
        // Edge case: 100% discount (total_amount = 0) and no payment needed
        newStatus = "paid";
      } else if (newValue >= totalAmount) {
        newStatus = "paid";
      } else if (newValue > 0 && newValue < totalAmount) {
        newStatus = "partial";
      } else if (newValue === 0) {
        newStatus = "open";
      }

      // Update recorded_payment and status in invoices table
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          recorded_payment: newValue,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      // Log to audit trail
      await supabase.from("audit_log").insert({
        entity: "invoice",
        entity_id: invoice.id,
        action: "update_recorded_payment",
        actor_user_id: user?.id,
        diff: {
          old_recorded_payment: invoice.recorded_payment ?? 0,
          new_recorded_payment: newValue,
          old_status: invoice.status,
          new_status: newStatus,
          payment_date: editDate,
          payment_method: editMethod,
          student_id: invoice.student_id,
          month: invoice.month,
        },
      });

      // Invalidate React Query caches
      queryClient.invalidateQueries({ queryKey: ["admin-tuition-list", month] });
      queryClient.invalidateQueries({ queryKey: ["student-tuition", invoice.student_id, invoice.month] });

      toast.success("Payment recorded successfully");
      handleCancelEdit();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast.error(error.message || "Failed to record payment");
    }
  };

  const getStatusBadge = (item: any) => {
    const recordedPayment = item.recorded_payment ?? item.paid_amount;
    if (recordedPayment > item.total_amount) {
      return <Badge className="bg-blue-500">Overpaid</Badge>;
    }
    if (recordedPayment === item.total_amount && item.total_amount > 0) {
      return <Badge className="bg-green-500">Settled</Badge>;
    }
    if (recordedPayment < item.total_amount && recordedPayment > 0) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          Underpaid
        </Badge>
      );
    }
    if (recordedPayment >= item.total_amount && item.total_amount > 0) {
      return <Badge className="bg-green-500">Paid</Badge>;
    }
    return <Badge variant="secondary">Unpaid</Badge>;
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading tuition data...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Tuition Overview - {dayjs(month).format("MMMM YYYY")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          {/* Review Queue Button */}
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
          
          {/* Confirmation Status Filter */}
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
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {(item as any).classes?.length > 0 && (
                      <span className="font-medium">{(item as any).classes.map((c: any) => c.name).join(", ")}</span>
                    )}
                    <span>Base: {item.base_amount.toLocaleString()} ₫</span>
                    <span>Discount: -{item.discount_amount.toLocaleString()} ₫</span>
                    <span>Current: {item.total_amount.toLocaleString()} ₫</span>
                    <span className={item.priorBalance >= 0 ? "text-success" : "text-destructive"}>
                      Prior Bal: {item.priorBalance >= 0 ? "+" : ""}
                      {item.priorBalance.toLocaleString()} ₫
                    </span>
                    <span className="font-semibold text-primary">Payable: {item.finalPayable.toLocaleString()} ₫</span>
                    <div className="flex items-center gap-2">
                      {editingInvoiceId === item.id ? (
                        <div className="flex flex-col gap-2 min-w-[280px]">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Amount</label>
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Date</label>
                              <Input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Method</label>
                            <select
                              value={editMethod}
                              onChange={(e) => setEditMethod(e.target.value)}
                              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Card">Card</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => handleSaveEdit(item)} className="flex-1">
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span>Recorded Pay: {(item.recorded_payment ?? item.paid_amount).toLocaleString()} ₫</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={() => handleStartEdit(item)}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                    {item.balance !== 0 && (
                      <span className={item.balance > 0 ? "text-red-600" : "text-blue-600"}>
                        Balance: {item.balance.toLocaleString()} ₫
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/students/${item.student_id}`)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
