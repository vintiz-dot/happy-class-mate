import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Admin from "./Admin";
import { InvoiceDownloadButton } from "@/components/invoice/InvoiceDownloadButton";

export default function Tuition() {
  const { role } = useAuth();
  const { studentId } = useStudentProfile();
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const currentMonth = dayjs().format("YYYY-MM");

  // If admin, show admin finance page
  if (role === "admin") {
    return <Admin defaultTab="finance" />;
  }

  const { data: tuitionData, isLoading } = useQuery({
    queryKey: ["student-tuition", studentId, month],
    queryFn: async () => {
      if (!studentId) return null;

      const { data: student } = await supabase
        .from("students")
        .select("full_name")
        .eq("id", studentId)
        .maybeSingle();

      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", studentId)
        .eq("month", month)
        .maybeSingle();

      const { data: ledgerAccounts } = await supabase
        .from("ledger_accounts")
        .select("id, code")
        .eq("student_id", studentId);

      const accountIds = ledgerAccounts?.map(a => a.id) || [];

      const { data: entries } = await supabase
        .from("ledger_entries")
        .select("*")
        .in("account_id", accountIds)
        .eq("month", month)
        .order("occurred_at", { ascending: true });

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", studentId)
        .gte("occurred_at", `${month}-01`)
        .lte("occurred_at", `${month}-31`)
        .order("occurred_at", { ascending: true });

      // Count sessions for the month
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .lte("start_date", `${month}-31`)
        .or(`end_date.is.null,end_date.gte.${month}-01`);

      const classIds = enrollments?.map(e => e.class_id) || [];

      let sessionCount = 0;
      if (classIds.length > 0) {
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id, date")
          .in("class_id", classIds)
          .gte("date", `${month}-01`)
          .lte("date", `${month}-31`)
          .eq("status", "Held");

        // Count attendance records for this student
        const sessionIds = sessions?.map(s => s.id) || [];
        if (sessionIds.length > 0) {
          const { data: attendance, count } = await supabase
            .from("attendance")
            .select("id", { count: "exact" })
            .in("session_id", sessionIds)
            .eq("student_id", studentId)
            .in("status", ["Present", "Excused"]);

          sessionCount = count || 0;
        }
      }

      return {
        student,
        invoice,
        entries: entries || [],
        payments: payments || [],
        ledgerAccounts: ledgerAccounts || [],
        sessionCount,
      };
    },
    enabled: !!studentId,
  });

  const prevMonth = () => {
    setMonth(dayjs(month).subtract(1, "month").format("YYYY-MM"));
  };

  const nextMonth = () => {
    const next = dayjs(month).add(1, "month").format("YYYY-MM");
    if (next <= currentMonth) {
      setMonth(next);
    }
  };

  if (!studentId) {
    return (
      <Layout title="Tuition">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please select a student profile</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (isLoading) {
    return <Layout title="Tuition">Loading...</Layout>;
  }

  const arAccount = tuitionData?.ledgerAccounts.find(a => a.code === "AR");
  const balance = tuitionData?.entries
    .filter(e => e.account_id === arAccount?.id)
    .reduce((sum, e) => sum + e.debit - e.credit, 0) || 0;

  return (
    <Layout title="Tuition">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[200px] text-center">
              {dayjs(month).format("MMMM YYYY")}
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={nextMonth}
              disabled={dayjs(month).add(1, "month").format("YYYY-MM") > currentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {tuitionData?.invoice && studentId && (
            <InvoiceDownloadButton
              studentId={studentId}
              month={month}
            />
          )}
        </div>

        {!tuitionData?.invoice ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No tuition record found for {dayjs(month).format("MMMM YYYY")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Sessions Attended</CardDescription>
                  <CardTitle className="text-3xl">
                    {tuitionData?.sessionCount || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Base Tuition</CardDescription>
                  <CardTitle className="text-3xl">
                    {(tuitionData?.invoice?.base_amount || 0).toLocaleString()} ₫
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Discounts</CardDescription>
                  <CardTitle className="text-3xl text-green-600">
                    -{(tuitionData?.invoice?.discount_amount || 0).toLocaleString()} ₫
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Current Balance</CardDescription>
                  <CardTitle className="text-3xl">
                    {balance.toLocaleString()} ₫
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoice #{tuitionData.invoice.number}</CardTitle>
                    <CardDescription>
                      {tuitionData.student?.full_name} - {dayjs(month).format("MMMM YYYY")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Amount:</span>
                    <span>{tuitionData.invoice.base_amount.toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Discounts:</span>
                    <span>-{tuitionData.invoice.discount_amount.toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span>{tuitionData.invoice.total_amount.toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid:</span>
                    <span>{tuitionData.invoice.paid_amount.toLocaleString()} ₫</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {tuitionData?.payments && tuitionData.payments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>
                    Payments made in {dayjs(month).format("MMMM YYYY")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Memo</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tuitionData.payments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {dayjs(payment.occurred_at).format("MMM D, YYYY")}
                          </TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell>{payment.memo || "-"}</TableCell>
                          <TableCell className="text-right">
                            {payment.amount.toLocaleString()} ₫
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
