import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVND } from "@/lib/invoice/formatter";
import { format } from "date-fns";

interface PaymentDetailsTableProps {
  selectedMonth: string;
}

export function PaymentDetailsTable({ selectedMonth }: PaymentDetailsTableProps) {
  const { data: payments } = useQuery({
    queryKey: ["payments", selectedMonth],
    queryFn: async () => {
      const monthStart = `${selectedMonth}-01`;
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, occurred_at, memo, students(full_name)")
        .gte("occurred_at", monthStart)
        .lt("occurred_at", monthEnd)
        .order("occurred_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Memo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments?.map((payment: any) => (
            <TableRow key={payment.id}>
              <TableCell>{format(new Date(payment.occurred_at), "PP")}</TableCell>
              <TableCell>{payment.students?.full_name}</TableCell>
              <TableCell className="capitalize">{payment.method}</TableCell>
              <TableCell className="text-right font-medium">{formatVND(payment.amount)}</TableCell>
              <TableCell className="text-muted-foreground">{payment.memo || "-"}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell colSpan={3}>TOTAL PAYMENTS</TableCell>
            <TableCell className="text-right">{formatVND(totalPayments)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
