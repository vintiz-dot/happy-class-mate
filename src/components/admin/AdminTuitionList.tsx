import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TuitionPageFilters } from "@/components/admin/TuitionPageFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, DollarSign, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { dayjs } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdminTuitionListProps {
  month: string;
}

export const AdminTuitionList = ({ month }: AdminTuitionListProps) => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "balance" | "total" | "class">("name");
  const navigate = useNavigate();

  const { data: tuitionData, isLoading } = useQuery({
    queryKey: ["admin-tuition-list", month],
    queryFn: async () => {
      // Fetch invoices for the month
      const { data: invoices, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          students(id, full_name, family_id, families(id))
        `)
        .eq("month", month);

      if (invoiceError) throw invoiceError;

      // Fetch discount assignments
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;
      
      const { data: discounts } = await supabase
        .from("discount_assignments")
        .select("student_id, discount_def_id")
        .lte("effective_from", monthEnd)
        .or(`effective_to.is.null,effective_to.gte.${monthStart}`);

      const studentDiscounts = new Set(discounts?.map(d => d.student_id) || []);

      // Get families with multiple students
      const { data: students } = await supabase
        .from("students")
        .select("id, family_id")
        .eq("is_active", true);

      const familyCounts = new Map<string, number>();
      students?.forEach(s => {
        if (s.family_id) {
          familyCounts.set(s.family_id, (familyCounts.get(s.family_id) || 0) + 1);
        }
      });

      const siblingStudents = new Set(
        students?.filter(s => s.family_id && (familyCounts.get(s.family_id) || 0) >= 2).map(s => s.id) || []
      );

      // Fetch enrollments for the month to get class info
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          class_id,
          classes(id, name)
        `)
        .lte("start_date", monthEnd)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);

      // Map student to classes
      const studentClasses = new Map<string, any[]>();
      enrollments?.forEach(e => {
        const existing = studentClasses.get(e.student_id) || [];
        if (e.classes) {
          existing.push(Array.isArray(e.classes) ? e.classes[0] : e.classes);
        }
        studentClasses.set(e.student_id, existing);
      });

      return invoices?.map(inv => ({
        ...inv,
        hasDiscount: studentDiscounts.has(inv.student_id),
        hasSiblings: siblingStudents.has(inv.student_id),
        balance: inv.total_amount - inv.paid_amount,
        classes: studentClasses.get(inv.student_id) || [],
      })) || [];
    },
  });

  const filteredAndSortedData = useMemo(() => {
    if (!tuitionData) return [];

    let filtered = tuitionData;
    
    // Apply filter
    switch (activeFilter) {
      case "discount":
        filtered = tuitionData.filter(t => t.hasDiscount);
        break;
      case "no-discount":
        filtered = tuitionData.filter(t => !t.hasDiscount);
        break;
      case "siblings":
        filtered = tuitionData.filter(t => t.hasSiblings);
        break;
      case "paid":
        filtered = tuitionData.filter(t => t.paid_amount >= t.total_amount && t.total_amount > 0);
        break;
      case "overpaid":
        filtered = tuitionData.filter(t => t.paid_amount > t.total_amount);
        break;
      case "underpaid":
        filtered = tuitionData.filter(t => t.paid_amount < t.total_amount && t.paid_amount > 0);
        break;
      case "settled":
        filtered = tuitionData.filter(t => t.paid_amount === t.total_amount && t.total_amount > 0);
        break;
      default:
        filtered = tuitionData;
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
  }, [tuitionData, activeFilter, sortBy]);

  const filterChips = useMemo(() => {
    if (!tuitionData) return [];

    return [
      { key: "all", label: "All", count: tuitionData.length },
      { key: "discount", label: "Discount", count: tuitionData.filter(t => t.hasDiscount).length },
      { key: "no-discount", label: "No Discount", count: tuitionData.filter(t => !t.hasDiscount).length },
      { key: "siblings", label: "Siblings", count: tuitionData.filter(t => t.hasSiblings).length },
      { key: "paid", label: "Paid", count: tuitionData.filter(t => t.paid_amount >= t.total_amount && t.total_amount > 0).length },
      { key: "overpaid", label: "Overpaid", count: tuitionData.filter(t => t.paid_amount > t.total_amount).length },
      { key: "underpaid", label: "Underpaid", count: tuitionData.filter(t => t.paid_amount < t.total_amount && t.paid_amount > 0).length },
      { key: "settled", label: "Settled", count: tuitionData.filter(t => t.paid_amount === t.total_amount && t.total_amount > 0).length },
    ];
  }, [tuitionData]);

  const getStatusBadge = (item: any) => {
    if (item.paid_amount > item.total_amount) {
      return <Badge className="bg-blue-500">Overpaid</Badge>;
    }
    if (item.paid_amount === item.total_amount && item.total_amount > 0) {
      return <Badge className="bg-green-500">Settled</Badge>;
    }
    if (item.paid_amount < item.total_amount && item.paid_amount > 0) {
      return <Badge variant="outline" className="border-amber-500 text-amber-700">Underpaid</Badge>;
    }
    if (item.paid_amount >= item.total_amount && item.total_amount > 0) {
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
        <div className="space-y-3">
          <TuitionPageFilters
            filters={filterChips}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          
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
                      <span className="font-medium">
                        {(item as any).classes.map((c: any) => c.name).join(", ")}
                      </span>
                    )}
                    <span>Base: {item.base_amount.toLocaleString()} ₫</span>
                    <span>Discount: -{item.discount_amount.toLocaleString()} ₫</span>
                    <span>Total: {item.total_amount.toLocaleString()} ₫</span>
                    <span>Paid: {item.paid_amount.toLocaleString()} ₫</span>
                    {item.balance !== 0 && (
                      <span className={item.balance > 0 ? "text-red-600" : "text-blue-600"}>
                        Balance: {item.balance.toLocaleString()} ₫
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/students/${item.student_id}`)}
                >
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
