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
    queryKey: ["recorded-payments", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, recorded_payment, updated_at, student_id, students(full_name)")
        .eq("month", selectedMonth)
        .gt("recorded_payment", 0)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const totalPayments = payments?.reduce((sum, p) => sum + (p.recorded_payment || 0), 0) || 0;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments?.map((payment: any) => (
            <TableRow key={payment.id}>
              <TableCell>{format(new Date(payment.updated_at), "PP")}</TableCell>
              <TableCell>{payment.students?.full_name}</TableCell>
              <TableCell className="text-right font-medium">{formatVND(payment.recorded_payment)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell colSpan={2}>TOTAL PAYMENTS</TableCell>
            <TableCell className="text-right">{formatVND(totalPayments)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
