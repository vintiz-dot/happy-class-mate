import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { acquireLock, releaseLock, ymNowBangkok } from "../_lib/lock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklySlot {
  dayOfWeek: number;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  teacherId?: string;
}

const TZ = "Asia/Bangkok";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDateYMD(d: Date) {
  const y = d.getFullYear(); const m = pad2(d.getMonth() + 1); const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}
function nowInBangkok() {
  const d = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = await req.json().catch(() => ({}));
  const month: string = body?.month ?? ymNowBangkok();

  let lockAcquired = false;
  let revertPre: any = null;
  let revertPost: any = null;

  try {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format. Expected YYYY-MM");

    const { date: todayBkk, time: nowBkk } = nowInBangkok();

    console.log(`[generate-sessions] month=${month} today=${todayBkk} now=${nowBkk}`);

    // 1) Revert bad Held states before we touch anything
    {
      const { data, error } = await supabase.rpc("revert_invalid_held_sessions", {
        p_month: month,
        p_today: todayBkk,
        p_now: nowBkk,
      });
      if (error) console.error("[pre-revert] error", error);
      else revertPre = data;
    }

    // 2) Acquire lock
    lockAcquired = await acquireLock(supabase, "generate-sessions", month);
    if (!lockAcquired) {
      return new Response(JSON.stringify({
        success: false, reason: "Job already running", reverted: revertPre ?? { totalReverted: 0 }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // 3) Load active classes
    const { data: classes, error: classesErr } = await supabase
      .from("classes")
      .select("id,name,default_teacher_id,session_rate_vnd,schedule_template")
      .eq("is_active", true);
    if (classesErr) throw classesErr;

    // Month bounds
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    let totalCreated = 0;
    let totalCanceled = 0;
    let totalUpdated = 0;
    const issues: any[] = [];

    // 4) Reconcile per class
    for (const cls of classes ?? []) {
      const template = (cls.schedule_template as { weeklySlots: WeeklySlot[] } | null)?.weeklySlots ?? [];
      if (template.length === 0) {
        console.log(`[class:${cls.name}] no weeklySlots → skip`);
        continue;
      }

      // Build expected map for whole month
      const expected = new Map<string, { slot: WeeklySlot; teacherId: string }>();
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        const dateStr = fmtDateYMD(d);
        for (const slot of template.filter(s => s.dayOfWeek === dow)) {
          const assignedTeacherId = slot.teacherId || cls.default_teacher_id;
          expected.set(`${dateStr}|${slot.startTime}`, { slot, teacherId: assignedTeacherId });
        }
      }

      // Load all non-canceled sessions for this class in the month
      const { data: existingAll, error: exErr } = await supabase
        .from("sessions")
        .select("id,date,start_time,end_time,teacher_id,status")
        .eq("class_id", cls.id)
        .neq("status", "Canceled")
        .gte("date", fmtDateYMD(startDate))
        .lte("date", fmtDateYMD(endDate));
      if (exErr) throw exErr;

      // Split by applicability
      const futureScheduled = (existingAll ?? []).filter(s => s.status === "Scheduled" && s.date >= todayBkk);
      const pastHeld = (existingAll ?? []).filter(s => s.status === "Held" || s.date < todayBkk);

      // 4a) Cancel future Scheduled not in template
      {
        const toCancelIds = futureScheduled
          .filter(s => !expected.has(`${s.date}|${s.start_time}`))
          .map(s => s.id);

        if (toCancelIds.length > 0) {
          const { error } = await supabase.from("sessions").update({ status: "Canceled" }).in("id", toCancelIds);
          if (error) {
            issues.push({ class: cls.name, op: "cancel", error });
          } else {
            totalCanceled += toCancelIds.length;
          }
        }
      }

      // 4b) Update teacher/time for future Scheduled that are in template but differ
      for (const s of futureScheduled) {
        const key = `${s.date}|${s.start_time}`;
        const exp = expected.get(key);
        if (!exp) continue;

        const needsTeacher = exp.teacherId !== s.teacher_id;
        const needsEnd = exp.slot.endTime !== s.end_time;
        // start_time is key; changing it would require cancel+create. We keep start_time stable.
        if (!needsTeacher && !needsEnd) continue;

        // Check availability for new teacher/time excluding this session id
        const { data: ok, error: availErr } = await supabase.rpc("check_teacher_availability", {
          p_teacher_id: exp.teacherId,
          p_date: s.date,
          p_start_time: s.start_time,
          p_end_time: exp.slot.endTime,
          p_exclude_session_id: s.id,
        });
        if (availErr) { issues.push({ class: cls.name, op: "availability", session: s.id, error: availErr }); continue; }
        if (!ok) { issues.push({ class: cls.name, op: "availability", session: s.id, reason: "conflict" }); continue; }

        const { error: upErr } = await supabase
          .from("sessions")
          .update({ teacher_id: exp.teacherId, end_time: exp.slot.endTime })
          .eq("id", s.id);

        if (upErr) issues.push({ class: cls.name, op: "update", session: s.id, error: upErr });
        else totalUpdated += 1;
      }

      // Refresh current snapshot used for existence checks
      const currentAll = (await supabase
        .from("sessions")
        .select("id,date,start_time,end_time,teacher_id,status")
        .eq("class_id", cls.id)
        .neq("status", "Canceled")
        .gte("date", fmtDateYMD(startDate))
        .lte("date", fmtDateYMD(endDate))).data ?? [];

      const existsAtDT = (dateStr: string, start: string) =>
        currentAll.some(s => s.date === dateStr && s.start_time === start && s.status !== "Canceled");

      // 4c) Create missing future rows
      const toCreate: any[] = [];
      for (const [key, { slot, teacherId }] of expected.entries()) {
        const [dateStr, startTime] = key.split("|");
        if (dateStr < todayBkk) continue; // do not create in the past

        // If something already exists at same date/time (Scheduled or Held), skip
        if (existsAtDT(dateStr, startTime)) continue;

        // Availability for new row
        const { data: ok, error: availErr } = await supabase.rpc("check_teacher_availability", {
          p_teacher_id: teacherId,
          p_date: dateStr,
          p_start_time: startTime,
          p_end_time: slot.endTime,
        });
        if (availErr) { issues.push({ class: cls.name, op: "availability", key, error: availErr }); continue; }
        if (!ok) { issues.push({ class: cls.name, op: "availability", key, reason: "conflict" }); continue; }

        toCreate.push({
          class_id: cls.id,
          date: dateStr,
          start_time: startTime,
          end_time: slot.endTime,
          teacher_id: teacherId,
          status: "Scheduled",
        });
      }

      if (toCreate.length > 0) {
        const { error: insErr } = await supabase.from("sessions").insert(toCreate);
        if (insErr) issues.push({ class: cls.name, op: "insert", error: insErr });
        else totalCreated += toCreate.length;
      }

      // 4d) Audit: report Held rows with wrong teacher vs template
      for (const h of pastHeld) {
        const k = `${h.date}|${h.start_time}`;
        const exp = expected.get(k);
        if (exp && exp.teacherId !== h.teacher_id) {
          console.log(`⚠️ [audit] Held mismatch ${cls.name} ${h.date} ${h.start_time}: has ${h.teacher_id}, expected ${exp.teacherId}`);
        }
      }
    }

    // 5) Post-revert (cleanup any bad states that slipped through)
    {
      const { data, error } = await supabase.rpc("revert_invalid_held_sessions", {
        p_month: month,
        p_today: nowInBangkok().date,
        p_now: nowInBangkok().time,
      });
      if (error) console.error("[post-revert] error", error);
      else revertPost = data;
    }

    return new Response(JSON.stringify({
      success: true,
      month,
      created: totalCreated,
      updated: totalUpdated,
      canceled: totalCanceled,
      revertedPre: revertPre ?? { totalReverted: 0 },
      revertedPost: revertPost ?? { totalReverted: 0 },
      issues,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (e: any) {
    console.error("[generate-sessions] error", e?.message, e?.stack);
    return new Response(JSON.stringify({ error: e?.message, stack: e?.stack }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400
    });
  } finally {
    if (lockAcquired) {
      try { await releaseLock(supabase, "generate-sessions", month); }
      catch (e) { console.error("[generate-sessions] releaseLock error", e); }
    }
  }
});
