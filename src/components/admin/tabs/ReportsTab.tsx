import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, XCircle, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { monthKey } from "@/lib/date";
import { formatVND } from "@/lib/invoice/formatter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentDetailsTable } from "./PaymentDetailsTable";

const ReportsTab = () => {
  const [selectedMonth, setSelectedMonth] = useState(monthKey());

  // Get month options (last 6 months + next 2 months)
  const getMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -6; i <= 2; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value: ym, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
    }
    return options;
  };

  // Fetch cancelled sessions count and lost profit calculation
  const { data: lostRevenue } = useQuery({
    queryKey: ["lost-revenue", selectedMonth],
    queryFn: async () => {
      const monthStart = `${selectedMonth}-01`;
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      // Get cancelled sessions with class and teacher info
      const { data: cancelledSessions, error } = await supabase
        .from("sessions")
        .select(`
          id, date, start_time, end_time,
          classes (id, name, session_rate_vnd),
          teachers (id, hourly_rate_vnd)
        `)
        .eq("status", "Canceled")
        .gte("date", monthStart)
        .lt("date", monthEnd);

      if (error) throw error;

      let totalLostTuition = 0;
      let totalLostPayroll = 0;

      for (const session of cancelledSessions || []) {
        // Calculate session duration in hours
        const [startHr, startMin] = session.start_time.split(':').map(Number);
        const [endHr, endMin] = session.end_time.split(':').map(Number);
        const hours = ((endHr * 60 + endMin) - (startHr * 60 + startMin)) / 60;

        // Get enrolled student count for this class at time of session
        const { count } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("class_id", session.classes?.id)
          .lte("start_date", session.date)
          .or(`end_date.is.null,end_date.gte.${session.date}`);

        const studentCount = count || 0;
        const sessionRate = session.classes?.session_rate_vnd || 0;
        const teacherHourlyRate = session.teachers?.hourly_rate_vnd || 0;

        totalLostTuition += sessionRate * studentCount;
        totalLostPayroll += teacherHourlyRate * hours;
      }

      return {
        lostProfit: totalLostTuition - totalLostPayroll,
        lostTuition: totalLostTuition,
        savedPayroll: totalLostPayroll,
        sessionCount: cancelledSessions?.length || 0
      };
    },
  });

  // Fetch class finance data
  const { data: classFinance } = useQuery({
    queryKey: ["class-finance", selectedMonth],
    queryFn: async () => {
      const monthStart = `${selectedMonth}-01`;
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      // Get all classes
      const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select("id, name, session_rate_vnd")
        .eq("is_active", true);

      if (classesError) throw classesError;

      // For each class, calculate projected tuition and payroll
      const classData = await Promise.all(
        (classes || []).map(async (cls) => {
          // Get projected sessions (Scheduled + Held, excluding Canceled)
          const { data: sessions, error: sessionsError } = await supabase
            .from("sessions")
            .select("id, teacher_id, start_time, end_time, rate_override_vnd, status, teachers(hourly_rate_vnd)")
            .eq("class_id", cls.id)
            .in("status", ["Scheduled", "Held"])
            .gte("date", monthStart)
            .lt("date", monthEnd);

          if (sessionsError) throw sessionsError;

          // Get enrollments for student count
          const { data: enrollments, error: enrollmentsError } = await supabase
            .from("enrollments")
            .select("student_id")
            .eq("class_id", cls.id)
            .lte("start_date", monthEnd)
            .or(`end_date.is.null,end_date.gte.${monthStart}`);

          if (enrollmentsError) throw enrollmentsError;

          const sessionCount = sessions?.length || 0;
          const studentCount = enrollments?.length || 0;

          // Get actual tuition from invoices using class_breakdown for accurate per-class amounts
          // Use net_amount_vnd (post-discount) if available, otherwise fall back to amount_vnd
          let grossTuition = 0;
          let netTuition = 0;
          if (enrollments && enrollments.length > 0) {
            const studentIds = enrollments.map(e => e.student_id);
            const { data: invoices, error: invoicesError } = await supabase
              .from("invoices")
              .select("class_breakdown, student_id")
              .in("student_id", studentIds)
              .eq("month", selectedMonth);

            if (!invoicesError && invoices) {
              // Sum only the amount for THIS specific class from each invoice's class_breakdown
              invoices.forEach((inv) => {
                const breakdown = inv.class_breakdown as Array<{ class_id: string; amount_vnd: number; net_amount_vnd?: number }> | null;
                const classEntry = breakdown?.find(c => c.class_id === cls.id);
                if (classEntry) {
                  grossTuition += classEntry.amount_vnd || 0;
                  // Use net_amount_vnd if available, otherwise fall back to amount_vnd
                  netTuition += classEntry.net_amount_vnd ?? classEntry.amount_vnd ?? 0;
                }
              });
            }
          }

          // Calculate projected payroll for all sessions (Scheduled + Held)
          let payroll = 0;
          sessions?.forEach((session: any) => {
            const [startHr, startMin] = session.start_time.split(':').map(Number);
            const [endHr, endMin] = session.end_time.split(':').map(Number);
            const minutes = (endHr * 60 + endMin) - (startHr * 60 + startMin);
            const hours = minutes / 60;
            const rate = session.teachers?.hourly_rate_vnd || 0;
            payroll += hours * rate;
          });

          const discounts = grossTuition - netTuition;
          const net = netTuition - payroll;

          return {
            id: cls.id,
            name: cls.name,
            sessionCount,
            studentCount,
            grossTuition: Math.round(grossTuition),
            discounts: Math.round(discounts),
            tuition: Math.round(netTuition), // This is now net tuition (post-discount)
            payroll: Math.round(payroll),
            net: Math.round(net),
          };
        })
      );

      return classData;
    },
  });

  const totalGrossTuition = classFinance?.reduce((sum, c) => sum + c.grossTuition, 0) || 0;
  const totalDiscounts = classFinance?.reduce((sum, c) => sum + c.discounts, 0) || 0;
  const totalTuition = classFinance?.reduce((sum, c) => sum + c.tuition, 0) || 0;
  const totalPayroll = classFinance?.reduce((sum, c) => sum + c.payroll, 0) || 0;
  const totalNet = classFinance?.reduce((sum, c) => sum + c.net, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Select Month:</label>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getMonthOptions().map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cancelled Sessions & Lost Profit Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancelled Sessions
            </CardTitle>
            <CardDescription>
              Total sessions cancelled in {getMonthOptions().find(o => o.value === selectedMonth)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive">{lostRevenue?.sessionCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
              Lost Profit
            </CardTitle>
            <CardDescription>
              Potential profit lost from cancelled sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600">
              {formatVND(lostRevenue?.lostProfit || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-2 space-y-1">
              <p>Lost Tuition: {formatVND(lostRevenue?.lostTuition || 0)}</p>
              <p>Saved Payroll: {formatVND(lostRevenue?.savedPayroll || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payment Details
          </CardTitle>
          <CardDescription>
            All payments recorded for {getMonthOptions().find(o => o.value === selectedMonth)?.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentDetailsTable selectedMonth={selectedMonth} />
        </CardContent>
      </Card>

      {/* Class Finance Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Class Finance Report
          </CardTitle>
          <CardDescription>
            Financial breakdown by class for {getMonthOptions().find(o => o.value === selectedMonth)?.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Gross Tuition</TableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <TableHead className="text-right">Net Tuition</TableHead>
                <TableHead className="text-right">Payroll</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classFinance?.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="text-right">{cls.sessionCount}</TableCell>
                  <TableCell className="text-right">{cls.studentCount}</TableCell>
                  <TableCell className="text-right">{formatVND(cls.grossTuition)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {cls.discounts > 0 ? `-${formatVND(cls.discounts)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatVND(cls.tuition)}</TableCell>
                  <TableCell className="text-right">{formatVND(cls.payroll)}</TableCell>
                  <TableCell className={`text-right font-semibold ${cls.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatVND(cls.net)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">{formatVND(totalGrossTuition)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {totalDiscounts > 0 ? `-${formatVND(totalDiscounts)}` : '-'}
                </TableCell>
                <TableCell className="text-right">{formatVND(totalTuition)}</TableCell>
                <TableCell className="text-right">{formatVND(totalPayroll)}</TableCell>
                <TableCell className={`text-right ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatVND(totalNet)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
