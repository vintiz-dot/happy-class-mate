import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { dayjs } from "@/lib/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PayrollTab() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["admin-payroll", selectedMonth],
    queryFn: async () => {
      // Get all teachers
      const { data: teachers } = await supabase
        .from("teachers")
        .select("id, full_name, hourly_rate_vnd, is_active")
        .eq("is_active", true)
        .order("full_name");

      const teacherPayrolls = await Promise.all(
        (teachers || []).map(async (teacher) => {
          // Get both held and scheduled sessions
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
            .gte("date", `${selectedMonth}-01`)
            .lte("date", `${selectedMonth}-31`)
            .in("status", ["Held", "Scheduled"])
            .order("date", { ascending: true });

          const heldSessions = sessions?.filter(s => s.status === "Held") || [];
          const scheduledSessions = sessions?.filter(s => s.status === "Scheduled") || [];

          const calculateAmount = (sessionsList: any[]) => {
            return sessionsList.reduce((sum, s) => {
              const start = dayjs(`${s.date} ${s.start_time}`);
              const end = dayjs(`${s.date} ${s.end_time}`);
              const hours = end.diff(start, "hour", true);
              // Multiply hours by teacher's hourly rate
              return sum + Math.round(hours * teacher.hourly_rate_vnd);
            }, 0);
          };

          const totalHeld = calculateAmount(heldSessions);
          const totalScheduled = calculateAmount(scheduledSessions);

          return {
            teacher,
            heldSessions: heldSessions.length,
            scheduledSessions: scheduledSessions.length,
            totalEarned: totalHeld,
            projectedEarnings: totalScheduled,
            totalProjected: totalHeld + totalScheduled,
          };
        })
      );

      return teacherPayrolls;
    },
  });

  const exportPayroll = () => {
    const csv = [
      ["Teacher", "Held Sessions", "Scheduled Sessions", "Earned", "Projected", "Total Projected"].join(","),
      ...(payrollData || []).map((p) => [
        p.teacher.full_name,
        p.heldSessions,
        p.scheduledSessions,
        p.totalEarned,
        p.projectedEarnings,
        p.totalProjected,
      ].join(",")),
      ["", "", "", 
        (payrollData || []).reduce((sum, p) => sum + p.totalEarned, 0),
        (payrollData || []).reduce((sum, p) => sum + p.projectedEarnings, 0),
        (payrollData || []).reduce((sum, p) => sum + p.totalProjected, 0),
      ].join(",")
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teacher-payroll-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const month = dayjs().subtract(i, "month");
    return {
      value: month.format("YYYY-MM"),
      label: month.format("MMMM YYYY"),
    };
  });

  const grandTotalEarned = payrollData?.reduce((sum, p) => sum + p.totalEarned, 0) || 0;
  const grandTotalProjected = payrollData?.reduce((sum, p) => sum + p.totalProjected, 0) || 0;

  if (isLoading) {
    return <div>Loading payroll data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={exportPayroll} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Earned (Held Sessions)</CardDescription>
            <CardTitle className="text-3xl">{grandTotalEarned.toLocaleString()} ₫</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Projected (Held + Scheduled)</CardDescription>
            <CardTitle className="text-3xl text-primary">{grandTotalProjected.toLocaleString()} ₫</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Payroll Summary</CardTitle>
          <CardDescription>
            Payroll for {dayjs(selectedMonth).format("MMMM YYYY")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!payrollData || payrollData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No payroll data available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-center">Held</TableHead>
                  <TableHead className="text-center">Scheduled</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="text-right">Projected</TableHead>
                  <TableHead className="text-right">Total Projected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map((payroll) => (
                  <TableRow key={payroll.teacher.id}>
                    <TableCell className="font-medium">{payroll.teacher.full_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">{payroll.heldSessions}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{payroll.scheduledSessions}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{payroll.totalEarned.toLocaleString()} ₫</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      +{payroll.projectedEarnings.toLocaleString()} ₫
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {payroll.totalProjected.toLocaleString()} ₫
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">
                    {payrollData.reduce((sum, p) => sum + p.heldSessions, 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {payrollData.reduce((sum, p) => sum + p.scheduledSessions, 0)}
                  </TableCell>
                  <TableCell className="text-right">{grandTotalEarned.toLocaleString()} ₫</TableCell>
                  <TableCell className="text-right">
                    +{(grandTotalProjected - grandTotalEarned).toLocaleString()} ₫
                  </TableCell>
                  <TableCell className="text-right">{grandTotalProjected.toLocaleString()} ₫</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
