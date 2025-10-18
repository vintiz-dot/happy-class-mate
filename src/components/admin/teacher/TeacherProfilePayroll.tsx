import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeacherProfilePayrollProps {
  teacherId: string;
  selectedMonth: string;
  hourlyRate: number;
}

export function TeacherProfilePayroll({ teacherId, selectedMonth, hourlyRate }: TeacherProfilePayrollProps) {
  const { data: payrollData } = useQuery({
    queryKey: ["teacher-payroll-detail", teacherId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-payroll", {
        body: { month: selectedMonth, teacherId },
      });
      if (error) throw error;
      return data?.payrollData?.[0];
    },
  });

  const calculateSessionAmount = (session: any) => {
    const [startHour, startMin] = session.start_time.split(":").map(Number);
    const [endHour, endMin] = session.end_time.split(":").map(Number);
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const hours = durationMinutes / 60;
    return Math.round(hours * (session.rate_override_vnd || hourlyRate));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Projected Total</CardDescription>
            <CardTitle className="text-3xl">
              {(payrollData?.totalAmountProjected || 0).toLocaleString()} ₫
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on {payrollData?.sessionsCountProjected || 0} scheduled sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current (Actual)</CardDescription>
            <CardTitle className="text-3xl">
              {(payrollData?.totalAmountActual || 0).toLocaleString()} ₫
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              From {payrollData?.sessionsCountActual || 0} held sessions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>Per-session earnings breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {payrollData?.sessions && payrollData.sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.sessions.map((session: any) => {
                  const amount = calculateSessionAmount(session);
                  return (
                    <TableRow key={session.id}>
                      <TableCell>{new Date(session.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                      </TableCell>
                      <TableCell>
                        {(session.durationMinutes / 60).toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.status === "Held" ? "default" : "secondary"} className={session.status === "Held" ? "bg-green-500" : ""}>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {amount.toLocaleString()} ₫
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No sessions this month</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
