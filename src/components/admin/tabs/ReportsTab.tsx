import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, XCircle, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { monthKey } from "@/lib/date";
import { formatVND } from "@/lib/invoice/formatter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  // Fetch cancelled sessions count
  const { data: cancelledSessions } = useQuery({
    queryKey: ["cancelled-sessions", selectedMonth],
    queryFn: async () => {
      const monthStart = `${selectedMonth}-01`;
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from("sessions")
        .select("id, class_id, classes(name)")
        .eq("status", "Canceled")
        .gte("date", monthStart)
        .lt("date", monthEnd);

      if (error) throw error;
      return data || [];
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

      // For each class, calculate tuition and payroll
      const classData = await Promise.all(
        (classes || []).map(async (cls) => {
          // Get held sessions for this class in the month
          const { data: sessions, error: sessionsError } = await supabase
            .from("sessions")
            .select("id, teacher_id, start_time, end_time, rate_override_vnd, teachers(hourly_rate_vnd)")
            .eq("class_id", cls.id)
            .eq("status", "Held")
            .gte("date", monthStart)
            .lt("date", monthEnd);

          if (sessionsError) throw sessionsError;

          // Get enrollments for tuition calculation
          const { data: enrollments, error: enrollmentsError } = await supabase
            .from("enrollments")
            .select("student_id")
            .eq("class_id", cls.id)
            .lte("start_date", monthEnd)
            .or(`end_date.is.null,end_date.gte.${monthStart}`);

          if (enrollmentsError) throw enrollmentsError;

          const sessionCount = sessions?.length || 0;
          const studentCount = enrollments?.length || 0;
          const tuition = sessionCount * studentCount * cls.session_rate_vnd;

          // Calculate payroll
          let payroll = 0;
          sessions?.forEach((session: any) => {
            const [startHr, startMin] = session.start_time.split(':').map(Number);
            const [endHr, endMin] = session.end_time.split(':').map(Number);
            const minutes = (endHr * 60 + endMin) - (startHr * 60 + startMin);
            const hours = minutes / 60;
            const rate = session.teachers?.hourly_rate_vnd || 0;
            payroll += hours * rate;
          });

          const net = tuition - payroll;

          return {
            id: cls.id,
            name: cls.name,
            sessionCount,
            studentCount,
            tuition,
            payroll: Math.round(payroll),
            net: Math.round(net),
          };
        })
      );

      return classData;
    },
  });

  const totalCancelled = cancelledSessions?.length || 0;
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

      {/* Cancelled Classes Summary */}
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
          <div className="text-4xl font-bold text-destructive">{totalCancelled}</div>
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
                <TableHead className="text-right">Tuition</TableHead>
                <TableHead className="text-right">Payroll</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classFinance?.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="text-right">{cls.sessionCount}</TableCell>
                  <TableCell className="text-right">{cls.studentCount}</TableCell>
                  <TableCell className="text-right">{formatVND(cls.tuition)}</TableCell>
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
