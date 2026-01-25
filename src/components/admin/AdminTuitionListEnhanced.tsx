import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TuitionSummaryCards } from "@/components/admin/tuition/TuitionSummaryCards";
import { TuitionToolbar } from "@/components/admin/tuition/TuitionToolbar";
import { TuitionStudentCard } from "@/components/admin/tuition/TuitionStudentCard";
import { dayjs } from "@/lib/date";
import { toast } from "sonner";
import { z } from "zod";
import { getPaymentStatus } from "@/lib/tuitionStatus";
import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";

const PaymentSchema = z.object({
  amount: z.number().min(0, "Amount must be positive").max(100000000, "Amount too large"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  method: z.enum(["Cash", "Bank Transfer", "Card", "Other"], {
    errorMap: () => ({ message: "Invalid payment method" }),
  }),
});

interface AdminTuitionListEnhancedProps {
  month: string;
}

export const AdminTuitionListEnhanced = ({ month }: AdminTuitionListEnhancedProps) => {
  const [sortBy, setSortBy] = useState<"name" | "balance" | "total" | "class">("name");
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmationFilter, setConfirmationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState("Cash");
  const queryClient = useQueryClient();

  const { data: tuitionData, isLoading, refetch, isRefetching } = useQuery({
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
        .select(`student_id, class_id, classes(id, name)`)
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

      // Calculate prior balance for each student
      const priorBalanceMap = new Map<string, number>();
      priorInvoices?.forEach((inv) => {
        const currentBalance = priorBalanceMap.get(inv.student_id) || 0;
        priorBalanceMap.set(inv.student_id, currentBalance + (inv.recorded_payment || 0) - (inv.total_amount || 0));
      });

      // Build tuition data for ALL active students
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
          month: month,
          base_amount: invoice?.base_amount || 0,
          discount_amount: invoice?.discount_amount || 0,
          total_amount: currentCharges,
          paid_amount: invoice?.paid_amount || 0,
          recorded_payment: recordedPayment,
          status: invoice?.status || "open",
          confirmation_status: invoice?.confirmation_status || "needs_review",
          students: student,
          hasDiscount: studentDiscounts.has(student.id),
          hasSiblings: siblingStudents.has(student.id),
          priorBalance: priorBalance,
          finalPayable: finalPayable,
          balance: finalPayable - recordedPayment,
          classes: studentClasses.get(student.id) || [],
          carry_out_credit: invoice?.carry_out_credit ?? carryOutCredit,
          carry_out_debt: invoice?.carry_out_debt ?? carryOutDebt,
        };
      });
    },
  });

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!tuitionData) return null;
    
    const getStatus = (item: any) => getPaymentStatus({
      carryOutDebt: item.carry_out_debt ?? 0,
      carryOutCredit: item.carry_out_credit ?? 0,
      totalAmount: item.total_amount ?? 0,
      monthPayments: item.recorded_payment ?? 0,
    });

    const settledCount = tuitionData.filter((i) => getStatus(i) === 'settled').length;
    const overpaidCount = tuitionData.filter((i) => getStatus(i) === 'overpaid').length;
    const underpaidCount = tuitionData.filter((i) => getStatus(i) === 'underpaid').length;
    const unpaidCount = tuitionData.filter((i) => getStatus(i) === 'unpaid').length;
    
    const totalBilled = tuitionData.reduce((sum, i) => sum + i.finalPayable, 0);
    const totalCollected = tuitionData.reduce((sum, i) => sum + (i.recorded_payment ?? 0), 0);
    const totalOutstanding = tuitionData.reduce((sum, i) => sum + Math.max(0, i.balance), 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    return {
      totalStudents: tuitionData.length,
      settledCount,
      overpaidCount,
      underpaidCount,
      unpaidCount,
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate,
      discountStudents: tuitionData.filter((i) => i.hasDiscount).length,
      siblingStudents: tuitionData.filter((i) => i.hasSiblings).length,
    };
  }, [tuitionData]);

  // Generate filter chips with counts
  const filterChips = useMemo(() => {
    if (!tuitionData) return [];
    
    const getStatus = (item: any) => getPaymentStatus({
      carryOutDebt: item.carry_out_debt ?? 0,
      carryOutCredit: item.carry_out_credit ?? 0,
      totalAmount: item.total_amount ?? 0,
      monthPayments: item.recorded_payment ?? 0,
    });
    
    const overpaid = tuitionData.filter((i) => getStatus(i) === 'overpaid').length;
    const settled = tuitionData.filter((i) => getStatus(i) === 'settled').length;
    const underpaid = tuitionData.filter((i) => getStatus(i) === 'underpaid').length;
    const unpaid = tuitionData.filter((i) => getStatus(i) === 'unpaid').length;
    const paid = settled + overpaid;

    return [
      { key: "all", label: "All", count: tuitionData.length },
      { key: "paid", label: "Paid", count: paid },
      { key: "overpaid", label: "Overpaid", count: overpaid },
      { key: "underpaid", label: "Underpaid", count: underpaid },
      { key: "settled", label: "Settled", count: settled },
      { key: "discount", label: "Discount", count: tuitionData.filter((i) => i.hasDiscount).length },
      { key: "siblings", label: "Siblings", count: tuitionData.filter((i) => i.hasSiblings).length },
    ];
  }, [tuitionData]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!tuitionData) return [];

    const getStatus = (item: any) => getPaymentStatus({
      carryOutDebt: item.carry_out_debt ?? 0,
      carryOutCredit: item.carry_out_credit ?? 0,
      totalAmount: item.total_amount ?? 0,
      monthPayments: item.recorded_payment ?? 0,
    });

    let filtered = tuitionData;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const name = (item.students as any)?.full_name?.toLowerCase() || "";
        const classes = (item as any).classes?.map((c: any) => c.name.toLowerCase()).join(" ") || "";
        return name.includes(query) || classes.includes(query);
      });
    }

    // Apply status filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((item) => {
        const status = getStatus(item);
        switch (activeFilter) {
          case "discount": return item.hasDiscount;
          case "siblings": return item.hasSiblings;
          case "paid": return status === 'settled' || status === 'overpaid';
          case "overpaid": return status === 'overpaid';
          case "underpaid": return status === 'underpaid';
          case "settled": return status === 'settled';
          default: return true;
        }
      });
    }

    // Apply confirmation filter
    if (confirmationFilter !== "all") {
      filtered = filtered.filter((item) => 
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
  }, [tuitionData, sortBy, activeFilter, confirmationFilter, searchQuery]);

  const reviewQueueCount = useMemo(() => {
    return tuitionData?.filter((i) => i.confirmation_status === 'needs_review').length || 0;
  }, [tuitionData]);

  const handleStartEdit = (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    const balance = invoice.finalPayable - (invoice.recorded_payment ?? 0);
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
      const { data: { user } } = await supabase.auth.getUser();

      let newStatus = invoice.status;
      const totalAmount = invoice.total_amount;

      if (newValue === 0 && totalAmount === 0) {
        newStatus = "paid";
      } else if (newValue >= totalAmount) {
        newStatus = "paid";
      } else if (newValue > 0 && newValue < totalAmount) {
        newStatus = "partial";
      } else if (newValue === 0) {
        newStatus = "open";
      }

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          recorded_payment: newValue,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

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

      queryClient.invalidateQueries({ queryKey: ["admin-tuition-list", month] });
      queryClient.invalidateQueries({ queryKey: ["student-tuition", invoice.student_id, invoice.month] });

      toast.success("Payment recorded successfully");
      handleCancelEdit();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast.error(error.message || "Failed to record payment");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tuition Overview</h2>
        <p className="text-muted-foreground">{dayjs(month).format("MMMM YYYY")}</p>
      </div>

      {/* Summary Cards */}
      <TuitionSummaryCards stats={stats!} isLoading={isLoading} />

      {/* Toolbar */}
      <TuitionToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={(s) => setSortBy(s as any)}
        filters={filterChips}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        confirmationFilter={confirmationFilter}
        onConfirmationFilterChange={setConfirmationFilter}
        reviewQueueCount={reviewQueueCount}
        month={month}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
      />

      {/* Student List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredAndSortedData.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <FileSearch className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No students found</h3>
          <p className="text-muted-foreground text-sm max-w-md mt-1">
            {searchQuery 
              ? `No results for "${searchQuery}". Try a different search term.`
              : "No tuition records match your current filters."}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedData.map((item, index) => (
            <TuitionStudentCard
              key={item.id}
              item={item}
              month={month}
              isEditing={editingInvoiceId === item.id}
              editValue={editValue}
              editDate={editDate}
              editMethod={editMethod}
              onStartEdit={() => handleStartEdit(item)}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={() => handleSaveEdit(item)}
              onEditValueChange={setEditValue}
              onEditDateChange={setEditDate}
              onEditMethodChange={setEditMethod}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!isLoading && filteredAndSortedData.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredAndSortedData.length} of {tuitionData?.length || 0} students
        </p>
      )}
    </div>
  );
};
