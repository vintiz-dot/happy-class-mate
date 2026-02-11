import { useState, useMemo } from "react";
import { TuitionSummaryCards } from "@/components/admin/tuition/TuitionSummaryCards";
import { TuitionToolbar } from "@/components/admin/tuition/TuitionToolbar";
import { TuitionStudentCard } from "@/components/admin/tuition/TuitionStudentCard";
import { dayjs } from "@/lib/date";
import { getPaymentStatus } from "@/lib/tuitionStatus";
import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { useLiveTuitionData } from "@/hooks/useLiveTuitionData";
import { RecordPaymentDialog } from "@/components/admin/RecordPaymentDialog";

interface AdminTuitionListEnhancedProps {
  month: string;
}

export const AdminTuitionListEnhanced = ({ month }: AdminTuitionListEnhancedProps) => {
  const [sortBy, setSortBy] = useState<"name" | "balance" | "total" | "class">("name");
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmationFilter, setConfirmationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentItem, setPaymentItem] = useState<any>(null);

  // Use live tuition data from calculate-tuition edge function
  const { data: tuitionData, isLoading, refetch, isRefetching } = useLiveTuitionData(month);

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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const name = (item.students as any)?.full_name?.toLowerCase() || "";
        const classes = (item as any).classes?.map((c: any) => c.name.toLowerCase()).join(" ") || "";
        return name.includes(query) || classes.includes(query);
      });
    }

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

    if (confirmationFilter !== "all") {
      filtered = filtered.filter((item) => 
        item.confirmation_status === confirmationFilter
      );
    }

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
              onRecordPay={() => setPaymentItem(item)}
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

      <RecordPaymentDialog
        open={!!paymentItem}
        onClose={() => setPaymentItem(null)}
        item={paymentItem}
        month={month}
      />
    </div>
  );
};
