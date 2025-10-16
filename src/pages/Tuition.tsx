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

      // Fetch student info
      const { data: student } = await supabase
        .from("students")
        .select("full_name")
        .eq("id", studentId)
        .maybeSingle();

      // Fetch invoice data directly from database
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", studentId)
        .eq("month", month)
        .maybeSingle();

      // Fetch payments from database
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", studentId)
        .gte("occurred_at", monthStart)
        .lte("occurred_at", monthEnd)
        .order("occurred_at", { ascending: true });

      // Fetch enrollments and sessions for session breakdown
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id, classes(name)")
        .eq("student_id", studentId)
        .lte("start_date", `${month}-31`)
        .or(`end_date.is.null,end_date.gte.${month}-01`);

      const classIds = enrollments?.map(e => e.class_id) || [];
      let sessionDetails: any[] = [];
      
      if (classIds.length > 0) {
        const { data: sessions } = await supabase
          .from("sessions")
          .select(`
            id,
            date,
            start_time,
            end_time,
            status,
            class_id,
            classes(name)
          `)
          .in("class_id", classIds)
          .gte("date", `${month}-01`)
          .lte("date", `${month}-31`)
          .in("status", ["Held", "Scheduled"])
          .order("date", { ascending: true });

        sessionDetails = sessions || [];
      }

      return {
        student,
        invoice: invoice || null,
        payments: payments || [],
        sessionDetails,
        baseAmount: invoice?.base_amount || 0,
        totalAmount: invoice?.total_amount || 0,
        discountAmount: invoice?.discount_amount || 0,
        recordedPayment: invoice?.recorded_payment || 0,
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
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Base Tuition</p>
                    <p className="text-lg font-semibold">{tuitionData.baseAmount.toLocaleString()} ₫</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Discount</p>
                    <p className="text-lg font-semibold text-green-600">-{tuitionData.discountAmount.toLocaleString()} ₫</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Due</p>
                    <p className="text-lg font-semibold">{tuitionData.totalAmount.toLocaleString()} ₫</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="text-lg font-semibold text-blue-600">{tuitionData.recordedPayment.toLocaleString()} ₫</p>
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

            {tuitionData?.sessionDetails && tuitionData.sessionDetails.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                  <CardDescription>
                    Classes attended in {dayjs(month).format("MMMM YYYY")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tuitionData.sessionDetails.map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            {dayjs(session.date).format("MMM D, YYYY")}
                          </TableCell>
                          <TableCell>{session.classes?.name || "-"}</TableCell>
                          <TableCell>
                            {session.start_time} - {session.end_time}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              session.status === "Held" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {session.status}
                            </span>
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
