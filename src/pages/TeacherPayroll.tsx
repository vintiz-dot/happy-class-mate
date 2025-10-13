import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) throw new Error("Not a teacher");

      const { data: summary } = await supabase
        .from("payroll_summaries")
        .select("*")
        .eq("teacher_id", teacher.id)
        .eq("month", month)
        .maybeSingle();

      // Fetch both held and scheduled sessions
      const { data: sessions } = await supabase
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

      return {
        summary,
        sessions: sessions || [],
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
    const rate = session.rate_override_vnd || session.classes.session_rate_vnd;
    const startTime = dayjs(`${session.date} ${session.start_time}`);
    const endTime = dayjs(`${session.date} ${session.end_time}`);
    const hours = endTime.diff(startTime, "hour", true);
    return Math.round(rate * hours / 1.5); // Assuming 1.5 hour default
  };

  const exportPayroll = () => {
    const csv = [
      ["Date", "Class", "Start Time", "End Time", "Status", "Duration (hrs)", "Rate", "Amount"].join(","),
      ...(payrollData?.sessions || []).map((s: any) => {
        const startTime = dayjs(`${s.date} ${s.start_time}`);
        const endTime = dayjs(`${s.date} ${s.end_time}`);
        const hours = endTime.diff(startTime, "hour", true).toFixed(2);
        const rate = s.rate_override_vnd || s.classes.session_rate_vnd;
        const amount = calculateSessionAmount(s);
        return [
          s.date,
          s.classes.name,
          s.start_time,
          s.end_time,
          s.status,
          hours,
          rate,
          amount
        ].join(",");
      }),
      ["", "", "", "", "", "", "Held Total", totalEarned].join(","),
      ["", "", "", "", "", "", "Projected", projectedEarnings].join(","),
      ["", "", "", "", "", "", "Total Projected", totalProjected].join(",")
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

  const heldSessions = payrollData?.sessions.filter((s: any) => s.status === "Held") || [];
  const scheduledSessions = payrollData?.sessions.filter((s: any) => s.status === "Scheduled") || [];

  const totalEarned = heldSessions.reduce((sum: number, s: any) => sum + calculateSessionAmount(s), 0);
  const projectedEarnings = scheduledSessions.reduce((sum: number, s: any) => sum + calculateSessionAmount(s), 0);
  const totalProjected = totalEarned + projectedEarnings;

  const totalHours = heldSessions.reduce((sum: number, s: any) => {
    const start = dayjs(`${s.date} ${s.start_time}`);
    const end = dayjs(`${s.date} ${s.end_time}`);
    return sum + end.diff(start, "hour", true);
  }, 0);

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
          <Button onClick={exportPayroll} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {payrollData?.sessions.length === 0 ? (
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
                  <CardTitle className="text-3xl">{heldSessions.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Hours</CardDescription>
                  <CardTitle className="text-3xl">{totalHours.toFixed(1)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Amount Earned</CardDescription>
                  <CardTitle className="text-3xl">{totalEarned.toLocaleString()} ₫</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Projected Total</CardDescription>
                  <CardTitle className="text-3xl text-primary">
                    {totalProjected.toLocaleString()} ₫
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  +{projectedEarnings.toLocaleString()} ₫ from {scheduledSessions.length} scheduled
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Session Details</CardTitle>
                <CardDescription>
                  Sessions during {dayjs(month).format("MMMM YYYY")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payrollData?.sessions.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No sessions this month
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData?.sessions.map((session: any) => (
                        <TableRow key={session.id} className={session.status === "Scheduled" ? "opacity-60" : ""}>
                          <TableCell>
                            {dayjs(session.date).format("MMM D, YYYY")}
                          </TableCell>
                          <TableCell>{session.classes.name}</TableCell>
                          <TableCell>
                            {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={session.status === "Held" ? "default" : "secondary"}>
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {calculateSessionAmount(session).toLocaleString()} ₫
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
