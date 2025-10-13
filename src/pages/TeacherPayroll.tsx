import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TeacherPayroll() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const currentMonth = dayjs().format("YYYY-MM");

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["teacher-payroll", month],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id, hourly_rate_vnd")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) throw new Error("Not a teacher");

      const { data: summary } = await supabase
        .from("payroll_summaries")
        .select("*")
        .eq("teacher_id", teacher.id)
        .eq("month", month)
        .maybeSingle();

      // Get all sessions (held and scheduled) for projected earnings
      const { data: allSessions } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          rate_override_vnd,
          classes!inner(name, session_rate_vnd)
        `)
        .eq("teacher_id", teacher.id)
        .gte("date", `${month}-01`)
        .lte("date", `${month}-31`)
        .in("status", ["Held", "Scheduled"])
        .order("date", { ascending: true });

      const heldSessions = allSessions?.filter(s => s.status === "Held") || [];
      const scheduledSessions = allSessions?.filter(s => s.status === "Scheduled") || [];

      const calculateAmount = (sessions: any[]) => {
        return sessions.reduce((sum, session) => {
          const start = dayjs(`${session.date} ${session.start_time}`);
          const end = dayjs(`${session.date} ${session.end_time}`);
          const hours = end.diff(start, "hour", true);
          const rate = session.rate_override_vnd || session.classes.session_rate_vnd;
          return sum + (rate * hours / 1.5); // Assuming 1.5 hour base rate
        }, 0);
      };

      const heldAmount = calculateAmount(heldSessions);
      const projectedAmount = calculateAmount([...heldSessions, ...scheduledSessions]);

      return {
        summary,
        heldSessions,
        scheduledSessions,
        heldAmount,
        projectedAmount,
        hourlyRate: teacher.hourly_rate_vnd,
      };
    },
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

  const calculateSessionAmount = (session: any) => {
    const start = dayjs(`${session.date} ${session.start_time}`);
    const end = dayjs(`${session.date} ${session.end_time}`);
    const hours = end.diff(start, "hour", true);
    const rate = session.rate_override_vnd || session.classes.session_rate_vnd;
    return Math.round(rate * hours / 1.5);
  };

  const exportPayroll = () => {
    if (!payrollData) return;

    const csv = [
      ["Date", "Class", "Start", "End", "Duration (hrs)", "Rate", "Amount", "Status"].join(","),
      ...[...payrollData.heldSessions, ...payrollData.scheduledSessions].map((s: any) => {
        const start = dayjs(`${s.date} ${s.start_time}`);
        const end = dayjs(`${s.date} ${s.end_time}`);
        const hours = end.diff(start, "hour", true).toFixed(2);
        const rate = s.rate_override_vnd || s.classes.session_rate_vnd;
        const amount = calculateSessionAmount(s);
        return [
          s.date,
          s.classes.name,
          s.start_time,
          s.end_time,
          hours,
          rate,
          amount,
          s.status
        ].join(",");
      }),
      [],
      ["", "", "", "", "", "Held Amount", payrollData.heldAmount.toFixed(0), ""].join(","),
      ["", "", "", "", "", "Projected Total", payrollData.projectedAmount.toFixed(0), ""].join(",")
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <Layout title="Payroll">Loading...</Layout>;
  }

  const noData = !payrollData?.heldSessions.length && !payrollData?.scheduledSessions.length;

  return (
    <Layout title="Payroll">
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
          <Button onClick={exportPayroll} variant="outline" size="sm" disabled={noData}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {noData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No payroll record found for {dayjs(month).format("MMMM YYYY")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Held Sessions</CardDescription>
                  <CardTitle className="text-3xl">
                    {payrollData.heldSessions.length}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Hours (Held)</CardDescription>
                  <CardTitle className="text-3xl">
                    {payrollData.heldSessions.reduce((sum, s) => {
                      const start = dayjs(`${s.date} ${s.start_time}`);
                      const end = dayjs(`${s.date} ${s.end_time}`);
                      return sum + end.diff(start, "hour", true);
                    }, 0).toFixed(1)}h
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Amount Earned (Held)</CardDescription>
                  <CardTitle className="text-3xl">
                    {payrollData.heldAmount.toLocaleString()} ₫
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-primary">
                <CardHeader className="pb-2">
                  <CardDescription>Projected Total</CardDescription>
                  <CardTitle className="text-3xl text-primary">
                    {payrollData.projectedAmount.toLocaleString()} ₫
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    +{payrollData.scheduledSessions.length} scheduled session(s)
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Session Details</CardTitle>
                <CardDescription>
                  Sessions for {dayjs(month).format("MMMM YYYY")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...payrollData.heldSessions, ...payrollData.scheduledSessions].map((session: any) => {
                      const start = dayjs(`${session.date} ${session.start_time}`);
                      const end = dayjs(`${session.date} ${session.end_time}`);
                      const hours = end.diff(start, "hour", true);
                      
                      return (
                        <TableRow key={session.id} className={session.status === "Scheduled" ? "opacity-60" : ""}>
                          <TableCell>
                            {dayjs(session.date).format("MMM D, YYYY")}
                          </TableCell>
                          <TableCell>{session.classes.name}</TableCell>
                          <TableCell>
                            {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                          </TableCell>
                          <TableCell>{hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right">
                            {calculateSessionAmount(session).toLocaleString()} ₫
                          </TableCell>
                          <TableCell>
                            <Badge variant={session.status === "Held" ? "default" : "outline"}>
                              {session.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
