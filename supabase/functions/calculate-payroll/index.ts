// supabase/functions/calculate-payroll/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SessionRow = {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // "HH:MM" or "HH:MM:SS"
  end_time: string | null; // "HH:MM" or "HH:MM:SS"
  status?: string;
};

function monthRange(month: string) {
  // month = "YYYY-MM"
  const start = `${month}-01`;
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const nextMonth = d.toISOString().slice(0, 10); // YYYY-MM-01 of next month
  return { startDate: start, nextMonthStart: nextMonth };
}

function parseMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":");
  const hh = Number(h);
  const mm = Number(m ?? "0");
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function computeTotals(sessions: SessionRow[], hourlyRateVnd: number) {
  let totalMinutes = 0;
  const perSession: Array<{
    id: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    minutes: number;
    amount: number;
  }> = [];

  for (const s of sessions ?? []) {
    const startMin = parseMinutes(s.start_time);
    const endMin = parseMinutes(s.end_time);
    if (startMin == null || endMin == null) continue;

    let minutes = endMin - startMin;
    if (minutes <= 0) minutes += 24 * 60; // handle cross-midnight just in case

    minutes = Math.max(0, Math.round(minutes));
    const amount = Math.round((hourlyRateVnd / 60) * minutes);

    totalMinutes += minutes;
    perSession.push({
      id: s.id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      minutes,
      amount,
    });
  }

  const totalHours = +(totalMinutes / 60).toFixed(2);
  const totalAmount = Math.round((hourlyRateVnd / 60) * totalMinutes);

  return { totalMinutes, totalHours, totalAmount, perSession };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { month, teacherId } = await req.json();
    if (!month) throw new Error("Missing month parameter (YYYY-MM)");
    const { startDate, nextMonthStart } = monthRange(month);

    // Teachers
    let tq = supabase.from("teachers").select("id, full_name, hourly_rate_vnd, user_id").eq("is_active", true);

    if (teacherId) tq = tq.eq("id", teacherId);

    const { data: teachers, error: teachersError } = await tq;
    if (teachersError) throw teachersError;

    const results: Array<{
      teacherId: string;
      teacherName: string;
      hourlyRate: number;
      sessionsCountActual: number;
      sessionsCountProjected: number;
      totalMinutesActual: number;
      totalHoursActual: number;
      totalAmountActual: number;
      totalMinutesProjected: number;
      totalHoursProjected: number;
      totalAmountProjected: number;
      sessionDetailsActual: ReturnType<typeof computeTotals>["perSession"];
      sessionDetailsProjected: ReturnType<typeof computeTotals>["perSession"];
    }> = [];

    for (const t of teachers ?? []) {
      // Actual = Held only
      const { data: held, error: heldErr } = await supabase
        .from("sessions")
        .select("id, date, start_time, end_time, status")
        .eq("teacher_id", t.id)
        .eq("status", "Held")
        .gte("date", startDate)
        .lt("date", nextMonthStart);

      if (heldErr) throw heldErr;

      // Projected = Held + Scheduled (exclude Canceled)
      const { data: projected, error: projErr } = await supabase
        .from("sessions")
        .select("id, date, start_time, end_time, status")
        .eq("teacher_id", t.id)
        .in("status", ["Held", "Scheduled"])
        .gte("date", startDate)
        .lt("date", nextMonthStart);

      if (projErr) throw projErr;

      const actual = computeTotals(held ?? [], t.hourly_rate_vnd);
      const future = computeTotals(projected ?? [], t.hourly_rate_vnd);

      results.push({
        teacherId: t.id,
        teacherName: t.full_name,
        hourlyRate: t.hourly_rate_vnd,
        sessionsCountActual: held?.length ?? 0,
        sessionsCountProjected: projected?.length ?? 0,
        totalMinutesActual: actual.totalMinutes,
        totalHoursActual: actual.totalHours,
        totalAmountActual: actual.totalAmount,
        totalMinutesProjected: future.totalMinutes,
        totalHoursProjected: future.totalHours,
        totalAmountProjected: future.totalAmount,
        sessionDetailsActual: actual.perSession,
        sessionDetailsProjected: future.perSession,
      });

      // Upsert monthly summary for actuals (schema-safe)
      const { error: upErr } = await supabase.from("payroll_summaries").upsert(
        {
          teacher_id: t.id,
          month,
          total_hours: actual.totalHours,
          total_amount: actual.totalAmount,
          sessions_count: held?.length ?? 0,
        },
        { onConflict: "teacher_id,month", ignoreDuplicates: false },
      );
      if (upErr) throw upErr;
    }

    const body = {
      month,
      totalTeachers: results.length,
      grandTotalActual: results.reduce((s, r) => s + r.totalAmountActual, 0),
      grandTotalProjected: results.reduce((s, r) => s + r.totalAmountProjected, 0),
      payrollData: results,
    };

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
