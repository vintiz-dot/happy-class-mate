// supabase/functions/calculate-tuition/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AttendanceStatus = "Present" | "Absent" | "Excused";

interface SessionRow {
  id: string;
  date: string; // YYYY-MM-DD
  status: "Scheduled" | "Held" | "Canceled";
  classes: { session_rate_vnd: number } | null;
}

interface EnrollmentRow {
  class_id: string;
  discount_type: "percent" | "amount" | null;
  discount_value: number | null;
  discount_cadence: "monthly" | "yearly" | "once" | null;
}

function monthRange(month: string) {
  const startDate = `${month}-01`;
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const nextMonthStart = d.toISOString().slice(0, 10); // YYYY-MM-01
  return { startDate, nextMonthStart };
}

function sumPayments(rows: any[] | null | undefined) {
  if (!rows) return 0;
  return rows.reduce((s, r) => {
    const amt = Number(r.amount_vnd ?? r.amount ?? 0);
    return s + (Number.isFinite(amt) ? amt : 0);
  }, 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { studentId, month } = await req.json();
    if (!studentId || !month) throw new Error("Missing studentId or month (YYYY-MM)");

    const { startDate, nextMonthStart } = monthRange(month);

    // Student + family
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, family_id, families(id, sibling_percent_override)")
      .eq("id", studentId)
      .single();
    if (studentError) throw studentError;

    // Active enrollments
    const { data: enrollments, error: enrollErr } = await supabase
      .from("enrollments")
      .select("class_id, discount_type, discount_value, discount_cadence, start_date, end_date")
      .eq("student_id", studentId);
    if (enrollErr) throw enrollErr;

    const activeClassIds = (enrollments ?? [])
      .filter((e) => !e.end_date || e.end_date >= startDate) // still active in this month
      .map((e) => e.class_id);

    // Sessions for view (Scheduled + Held) within month
    const { data: sessions, error: sessErr } = await supabase
      .from("sessions")
      .select("id, date, status, class_id, classes(session_rate_vnd)")
      .in("class_id", activeClassIds.length ? activeClassIds : ["00000000-0000-0000-0000-000000000000"]) // guard empty IN
      .gte("date", startDate)
      .lt("date", nextMonthStart)
      .in("status", ["Scheduled", "Held"]);
    if (sessErr) throw sessErr;

    // Batch attendance for these sessions for this student
    const sessionIds = (sessions ?? []).map((s) => s.id);
    let attendanceMap = new Map<string, AttendanceStatus>();
    if (sessionIds.length) {
      const { data: atts, error: attErr } = await supabase
        .from("attendance")
        .select("session_id, status")
        .in("session_id", sessionIds)
        .eq("student_id", studentId);
      if (attErr) throw attErr;
      for (const a of atts ?? []) attendanceMap.set(a.session_id, a.status);
    }

    // Base charges: bill Present or Absent; Excused not billable
    let baseAmount = 0;
    const sessionDetails: Array<{ date: string; rate: number; status: AttendanceStatus | "Scheduled" }> = [];

    for (const s of sessions ?? []) {
      const att = attendanceMap.get(s.id);
      const rate = Number(s.classes?.session_rate_vnd ?? 0);
      // Only count if attendance exists and is billable OR session held without explicit attendance (default Present policy)
      const billable =
        att === "Present" || att === "Absent" || (s.status === "Held" && (att === undefined || att === null));

      if (billable && rate > 0) {
        baseAmount += rate;
        sessionDetails.push({ date: s.date, rate, status: (att ?? "Present") as any });
      } else {
        // still return session detail for UI if needed
        if (att) sessionDetails.push({ date: s.date, rate, status: att });
      }
    }

    // Discounts bucket
    const discounts: Array<{
      name: string;
      type: "percent" | "amount";
      value: number;
      amount: number;
      [k: string]: any;
    }> = [];
    let totalDiscount = 0;

    // Enrollment-level discounts (monthly/once)
    for (const e of (enrollments as EnrollmentRow[] | null | undefined) ?? []) {
      if (!e.discount_type || !e.discount_value) continue;
      const cadence = e.discount_cadence;
      if (cadence === "monthly" || cadence === "once") {
        const amt =
          e.discount_type === "percent"
            ? Math.round(baseAmount * (e.discount_value / 100))
            : Math.round(e.discount_value);
        if (amt > 0) {
          discounts.push({ name: "Enrollment Discount", type: e.discount_type, value: e.discount_value, amount: amt });
          totalDiscount += amt;
        }
      }
    }

    // Special per-student discounts
    const { data: discountAssignments } = await supabase
      .from("discount_assignments")
      .select("discount_definitions(*)")
      .eq("student_id", studentId)
      .lte("effective_from", nextMonthStart)
      .or(`effective_to.is.null,effective_to.gte.${startDate}`);
    for (const a of discountAssignments ?? []) {
      const def = (a as any).discount_definitions;
      if (!def || !def.is_active) continue;
      const amt = def.type === "percent" ? Math.round(baseAmount * (def.value / 100)) : Math.round(def.value);
      if (amt > 0) {
        discounts.push({ name: def.name, type: def.type, value: def.value, amount: amt });
        totalDiscount += amt;
      }
    }

    // Referral bonuses
    const { data: referralBonuses } = await supabase
      .from("referral_bonuses")
      .select("*")
      .eq("student_id", studentId)
      .lte("effective_from", nextMonthStart)
      .or(`effective_to.is.null,effective_to.gte.${startDate}`);
    for (const b of referralBonuses ?? []) {
      const amt = b.type === "percent" ? Math.round(baseAmount * (b.value / 100)) : Math.round(b.value);
      if (amt > 0) {
        discounts.push({ name: "Referral Bonus", type: b.type, value: b.value, amount: amt });
        totalDiscount += amt;
      }
    }

    // Sibling discount if assigned
    let siblingState: any = null;
    if (student?.families?.id) {
      const { data: sd } = await supabase
        .from("sibling_discount_state")
        .select("status, winner_student_id, sibling_percent, reason")
        .eq("family_id", student.families.id)
        .eq("month", month)
        .maybeSingle();
      if (sd) {
        siblingState = {
          status: sd.status,
          percent: sd.sibling_percent,
          reason: sd.reason,
          isWinner: sd.winner_student_id === studentId,
        };
        if (sd.status === "assigned" && sd.winner_student_id === studentId) {
          const amt = Math.round(baseAmount * (sd.sibling_percent / 100));
          if (amt > 0) {
            discounts.push({
              name: "Sibling Discount",
              type: "percent",
              value: sd.sibling_percent,
              amount: amt,
              isSiblingWinner: true,
            });
            totalDiscount += amt;
          }
        }
      }
    }

    const totalAmount = Math.max(0, baseAmount - totalDiscount);

    // ---------- Payments and carryovers ----------
    // Prior charges: sum invoices before this month
    let priorCharges = 0;
    try {
      const { data: priorInvoices } = await supabase
        .from("invoices")
        .select("total_amount, month")
        .lt("month", month)
        .eq("student_id", studentId);
      priorCharges = (priorInvoices ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    } catch {
      priorCharges = 0;
    }

    // Payments: use tolerant schema (amount_vnd OR amount) and paid_at OR created_at
    let priorPayments = 0;
    let monthPayments = 0;

    // try table 'payments'
    const paymentsTables = ["payments", "tuition_payments"];
    for (const t of paymentsTables) {
      try {
        const { data: paysBefore } = await supabase
          .from(t)
          .select("amount_vnd, amount, paid_at, created_at")
          .eq("student_id", studentId)
          .lt("paid_at", `${startDate}T23:59:59.999Z`);
        if (paysBefore) priorPayments += sumPayments(paysBefore);
      } catch {
        /* ignore */
      }

      try {
        const { data: paysBeforeCreated } = await supabase
          .from(t)
          .select("amount_vnd, amount, paid_at, created_at")
          .eq("student_id", studentId)
          .is("paid_at", null)
          .lt("created_at", `${startDate}T23:59:59.999Z`);
        if (paysBeforeCreated) priorPayments += sumPayments(paysBeforeCreated);
      } catch {
        /* ignore */
      }

      try {
        const { data: paysMonth } = await supabase
          .from(t)
          .select("amount_vnd, amount, paid_at, created_at")
          .eq("student_id", studentId)
          .gte("paid_at", `${startDate}T00:00:00.000Z`)
          .lt("paid_at", `${nextMonthStart}T00:00:00.000Z`);
        if (paysMonth) monthPayments += sumPayments(paysMonth);
      } catch {
        /* ignore */
      }

      try {
        const { data: paysMonthCreated } = await supabase
          .from(t)
          .select("amount_vnd, amount, paid_at, created_at")
          .eq("student_id", studentId)
          .is("paid_at", null)
          .gte("created_at", `${startDate}T00:00:00.000Z`)
          .lt("created_at", `${nextMonthStart}T00:00:00.000Z`);
        if (paysMonthCreated) monthPayments += sumPayments(paysMonthCreated);
      } catch {
        /* ignore */
      }
    }

    // Carry-in (credit positive, debt negative)
    const carryInBalance = priorPayments - priorCharges;
    const carryInCredit = carryInBalance > 0 ? carryInBalance : 0;
    const carryInDebt = carryInBalance < 0 ? Math.abs(carryInBalance) : 0;

    // Closing balance for this month: previous balance + current charges - current payments
    const closingBalance = carryInBalance + totalAmount - monthPayments;
    const carryOutCredit = closingBalance < 0 ? Math.abs(closingBalance) : 0;
    const carryOutDebt = closingBalance > 0 ? closingBalance : 0;

    const balanceStatus = carryOutCredit > 0 ? "credit" : carryOutDebt > 0 ? "debt" : "settled";

    const balanceMessage =
      balanceStatus === "credit"
        ? `Bạn có số dư thừa ${carryOutCredit.toLocaleString("vi-VN")} ₫ sẽ được chuyển sang tháng sau.`
        : balanceStatus === "debt"
          ? `Bạn còn nợ ${carryOutDebt.toLocaleString("vi-VN")} ₫ cần thanh toán.`
          : "Tháng này đã thanh toán đầy đủ.";

    // ---------- Persist invoice (safe) ----------
    // Try with extended fields first; fallback to minimal if schema lacks them.
    const invoicePayloadExtended: any = {
      student_id: studentId,
      month,
      base_amount: baseAmount,
      discount_amount: totalDiscount,
      total_amount: totalAmount,
      paid_amount: monthPayments,
      carry_in_credit: carryInCredit,
      carry_in_debt: carryInDebt,
      carry_out_credit: carryOutCredit,
      carry_out_debt: carryOutDebt,
      status: "issued",
      updated_at: new Date().toISOString(),
    };

    let invoiceUpsertOk = true;
    let invoiceErrorMsg = "";

    try {
      const { error: invoiceErr1 } = await supabase
        .from("invoices")
        .upsert(invoicePayloadExtended, { onConflict: "student_id,month" });
      if (invoiceErr1) {
        invoiceUpsertOk = false;
        invoiceErrorMsg = invoiceErr1.message;
      }
    } catch (e: any) {
      invoiceUpsertOk = false;
      invoiceErrorMsg = e?.message ?? String(e);
    }

    if (!invoiceUpsertOk) {
      // fallback minimal upsert (existing schema in your earlier code)
      const { error: invoiceErr2 } = await supabase.from("invoices").upsert(
        {
          student_id: studentId,
          month,
          base_amount: baseAmount,
          discount_amount: totalDiscount,
          total_amount: totalAmount,
          status: "issued",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,month" },
      );
      if (invoiceErr2) {
        console.error("Invoice upsert failed (both attempts):", invoiceErrorMsg, invoiceErr2.message);
      }
    }

    const response = {
      studentId,
      month,
      sessionCount: sessionDetails.length,
      sessionDetails,
      baseAmount,
      discounts,
      totalDiscount,
      totalAmount, // charges this month (post-discount)
      payments: {
        priorPayments,
        monthPayments,
      },
      carry: {
        carryInCredit,
        carryInDebt,
        carryOutCredit,
        carryOutDebt,
        status: balanceStatus, // 'credit' | 'debt' | 'settled'
        message: balanceMessage, // show in UI
      },
      siblingState,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
