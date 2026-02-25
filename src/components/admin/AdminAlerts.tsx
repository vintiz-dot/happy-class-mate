import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, DollarSign, BookOpen, UserX } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "overdue" | "ungraded" | "attendance";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  icon: typeof AlertTriangle;
}

export function AdminAlerts() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      const now = dayjs();
      const currentMonth = now.format("YYYY-MM");
      const results: Alert[] = [];

      // 1. Overdue payments: students with unpaid invoices from past months
      const { data: overdueInvoices } = await supabase
        .from("invoices")
        .select("student_id, month, total_amount, paid_amount, students:student_id(full_name)")
        .lt("month", currentMonth)
        .in("status", ["draft", "issued"])
        .order("month", { ascending: true })
        .limit(50);

      const overdueStudents = new Map<string, { name: string; totalOwed: number; months: string[] }>();
      for (const inv of overdueInvoices || []) {
        const owed = (inv.total_amount || 0) - (inv.paid_amount || 0);
        if (owed <= 0) continue;
        const existing = overdueStudents.get(inv.student_id);
        const name = (inv.students as any)?.full_name || "Unknown";
        if (existing) {
          existing.totalOwed += owed;
          existing.months.push(inv.month);
        } else {
          overdueStudents.set(inv.student_id, { name, totalOwed: owed, months: [inv.month] });
        }
      }

      for (const [sid, info] of overdueStudents) {
        results.push({
          id: `overdue-${sid}`,
          type: "overdue",
          severity: info.months.length >= 2 ? "high" : "medium",
          title: `${info.name} — overdue payment`,
          detail: `${new Intl.NumberFormat("vi-VN").format(info.totalOwed)}₫ across ${info.months.length} month(s)`,
          icon: DollarSign,
        });
      }

      // 2. Ungraded homework submissions (older than 3 days)
      const threeDaysAgo = now.subtract(3, "day").toISOString();
      const { data: ungradedSubs, count: ungradedCount } = await supabase
        .from("homework_submissions")
        .select("id, homework_id, homeworks:homework_id(title, classes:class_id(name))", { count: "exact" })
        .eq("status", "submitted")
        .lt("submitted_at", threeDaysAgo)
        .limit(5);

      if (ungradedCount && ungradedCount > 0) {
        results.push({
          id: "ungraded-hw",
          type: "ungraded",
          severity: ungradedCount >= 10 ? "high" : "medium",
          title: `${ungradedCount} ungraded submission${ungradedCount > 1 ? "s" : ""}`,
          detail: `Submitted more than 3 days ago and waiting for review`,
          icon: BookOpen,
        });
      }

      // 3. Students with low attendance this month (< 50% of held sessions)
      const monthStart = now.startOf("month").format("YYYY-MM-DD");
      const { data: heldSessions } = await supabase
        .from("sessions")
        .select("id, class_id")
        .gte("date", monthStart)
        .lte("date", now.format("YYYY-MM-DD"))
        .eq("status", "Held");

      if (heldSessions && heldSessions.length > 0) {
        const sessionIds = heldSessions.map((s) => s.id);
        const classIds = [...new Set(heldSessions.map((s) => s.class_id))];

        const [enrollmentsRes, attendanceRes] = await Promise.all([
          supabase
            .from("enrollments")
            .select("student_id, class_id, students:student_id(full_name)")
            .in("class_id", classIds)
            .or(`end_date.is.null,end_date.gte.${monthStart}`),
          supabase
            .from("attendance")
            .select("student_id, session_id, status")
            .in("session_id", sessionIds)
            .eq("status", "Present"),
        ]);

        // Count sessions per class
        const sessionsPerClass: Record<string, number> = {};
        for (const s of heldSessions) {
          sessionsPerClass[s.class_id] = (sessionsPerClass[s.class_id] || 0) + 1;
        }

        // Count attendance per student
        const presentByStudent: Record<string, number> = {};
        for (const a of attendanceRes.data || []) {
          presentByStudent[a.student_id] = (presentByStudent[a.student_id] || 0) + 1;
        }

        // Check each enrolled student
        const lowAttendance: string[] = [];
        const studentNames: Record<string, string> = {};
        for (const e of enrollmentsRes.data || []) {
          const totalSessions = sessionsPerClass[e.class_id] || 0;
          if (totalSessions < 3) continue; // Not enough data
          const attended = presentByStudent[e.student_id] || 0;
          const rate = attended / totalSessions;
          studentNames[e.student_id] = (e.students as any)?.full_name || "Unknown";
          if (rate < 0.5 && !lowAttendance.includes(e.student_id)) {
            lowAttendance.push(e.student_id);
          }
        }

        if (lowAttendance.length > 0) {
          const names = lowAttendance.slice(0, 3).map((id) => studentNames[id]);
          results.push({
            id: "low-attendance",
            type: "attendance",
            severity: lowAttendance.length >= 3 ? "high" : "medium",
            title: `${lowAttendance.length} student${lowAttendance.length > 1 ? "s" : ""} with low attendance`,
            detail: names.join(", ") + (lowAttendance.length > 3 ? ` and ${lowAttendance.length - 3} more` : ""),
            icon: UserX,
          });
        }
      }

      // Sort by severity
      const severityOrder = { high: 0, medium: 1, low: 2 };
      results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-10 bg-muted rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">All clear — no issues! ✅</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            Alerts
          </CardTitle>
          <Badge variant="destructive" className="text-xs">
            {alerts.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, i) => {
          const Icon = alert.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                alert.severity === "high" && "bg-destructive/5 border-destructive/20",
                alert.severity === "medium" && "bg-warning/5 border-warning/20",
                alert.severity === "low" && "bg-muted/40 border-border/50",
              )}
            >
              <Icon className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                alert.severity === "high" && "text-destructive",
                alert.severity === "medium" && "text-warning",
                alert.severity === "low" && "text-muted-foreground",
              )} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
