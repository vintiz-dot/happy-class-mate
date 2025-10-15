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

  // Student tuition page - accessible by students and families only
  if (role === "admin" || role === "teacher") {
    return (
      <Layout title="Tuition">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Access denied. This page is for students and families only.</p>
          </CardContent>
        </Card>
      </Layout>
    );
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

      // Fetch invoice and recalculate tuition to ensure latest data
      const { data: invoiceCalc, error: calcError } = await supabase.functions.invoke("calculate-tuition", {
        body: { studentId, month },
      });

      if (calcError) {
        console.error("Error calculating tuition:", calcError);
        return null;
      }

      const invoice = invoiceCalc || null;

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

      // Fetch payments for display
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", studentId)
        .gte("occurred_at", monthStart)
        .lte("occurred_at", monthEnd)
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
          .select("id, date, status")
          .in("class_id", classIds)
          .gte("date", `${month}-01`)
          .lte("date", `${month}-31`)
          .in("status", ["Held", "Scheduled"]);

        // Filter only held sessions that have actually passed (not future)
        const now = new Date();
        const heldSessions = sessions?.filter(s => {
          const sessionDate = new Date(`${s.date}T23:59:59`);
          return s.status === "Held" && sessionDate <= now;
        }) || [];

        // Count attendance records for held sessions only
        const sessionIds = heldSessions.map(s => s.id);
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
        invoice: invoice || null,
        entries: entries || [],
        payments: payments || [],
        ledgerAccounts: ledgerAccounts || [],
        sessionCount,
        baseAmount: invoiceCalc?.baseAmount || 0,
        totalAmount: invoiceCalc?.totalAmount || 0,
        discountAmount: invoiceCalc?.totalDiscount || 0,
        recordedPayment: invoiceCalc?.payments?.cumulativePaidAmount || 0,
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

  // Calculate balance from tuition data
  const balance = (tuitionData?.totalAmount || 0) - (tuitionData?.recordedPayment || 0);

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
          {tuitionData && studentId && (
            <InvoiceDownloadButton
              studentId={studentId}
              month={month}
            />
          )}
        </div>

        {!tuitionData || tuitionData.totalAmount === undefined ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No tuition record found for {dayjs(month).format("MMMM YYYY")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current Balance</CardDescription>
                <CardTitle className="text-4xl">
                  {balance.toLocaleString()} ₫
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {dayjs(month).format("MMMM YYYY")}
                </p>
              </CardContent>
            </Card>

            {tuitionData && studentId && (
              <InvoiceDownloadButton
                studentId={studentId}
                month={month}
              />
            )}

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
