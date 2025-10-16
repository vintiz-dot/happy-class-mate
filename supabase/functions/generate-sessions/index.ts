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
  endTime: string; // "HH:MM"
}

const TZ = "Asia/Bangkok";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDateYMD(d: Date) {
  // Use local JS date math; we only format Y-M-D from same object
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function nowInBangkok() {
  const d = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d); // HH:MM
  return { date, time };
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse request body once at the top
  const body = await req.json().catch(() => ({}));
  const month = body?.month ?? ymNowBangkok();
  
  // Grab Bangkok "today" and "now" once
  const { date: todayBkk, time: nowBkkHHMM } = nowInBangkok();
  const nowBkkMinutes = hhmmToMinutes(nowBkkHHMM);
  
  let lockAcquired = false;

  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error("Invalid month format. Expected YYYY-MM");
    }

    console.log(`[generate-sessions] Generating sessions for month: ${month}`);

    // Acquire lock
    lockAcquired = await acquireLock(supabase, "generate-sessions", month);
    if (!lockAcquired) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Job already running for this month",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Active classes
    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("id, name, default_teacher_id, session_rate_vnd, schedule_template")
      .eq("is_active", true);

    if (classesError) throw classesError;

    // Month boundaries
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // last day of month

    const sessionsToCreate: any[] = [];

    // Generate sessions
    for (const cls of classes || []) {
      const template = cls.schedule_template as { weeklySlots: WeeklySlot[] } | null;
      if (!template?.weeklySlots?.length) {
        console.log(`Class ${cls.name} has no weekly slots, skipping`);
        continue;
      }

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay(); // 0..6
        const dateStr = fmtDateYMD(d);

        const matchingSlots = template.weeklySlots.filter((s) => s.dayOfWeek === dayOfWeek);
        for (const slot of matchingSlots) {
          // Skip if identical session exists
          const { data: existing, error: existErr } = await supabase
            .from("sessions")
            .select("id")
            .eq("class_id", cls.id)
            .eq("date", dateStr)
            .eq("start_time", slot.startTime)
            .maybeSingle();
          if (existErr) throw existErr;
          if (existing) continue;

          // Teacher availability check
          const { data: available, error: availErr } = await supabase.rpc("check_teacher_availability", {
            p_teacher_id: cls.default_teacher_id,
            p_date: dateStr,
            p_start_time: slot.startTime,
            p_end_time: slot.endTime,
          });
          if (availErr) throw availErr;
          if (!available) {
            console.log(`Teacher conflict for ${cls.name} on ${dateStr} at ${slot.startTime}`);
            continue;
          }

          sessionsToCreate.push({
            class_id: cls.id,
            date: dateStr,
            start_time: slot.startTime,
            end_time: slot.endTime,
            teacher_id: cls.default_teacher_id,
            status: "Scheduled",
          });
        }
      }
    }

    console.log(`[generate-sessions] Creating ${sessionsToCreate.length} sessions`);
    if (sessionsToCreate.length > 0) {
      const { error: insertError } = await supabase.from("sessions").insert(sessionsToCreate);
      if (insertError) throw insertError;
    }

    // Call database function to revert invalid held sessions
    const { data: revertResult, error: revertError } = await supabase.rpc(
      "revert_invalid_held_sessions",
      {
        p_month: month,
        p_today: todayBkk,
        p_now: nowBkkHHMM,
      }
    );

    if (revertError) {
      console.error("[generate-sessions] Error reverting invalid held sessions:", revertError);
    } else {
      console.log(`[generate-sessions] Reverted invalid sessions:`, revertResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        month,
        sessionsCreated: sessionsToCreate.length,
        reverted: revertResult || { totalReverted: 0 },
        today: todayBkk,
        now: nowBkkHHMM,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("[generate-sessions] Error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } finally {
    // Always release lock if it was acquired
    if (lockAcquired) {
      try {
        await releaseLock(supabase, "generate-sessions", month);
      } catch (e) {
        console.error("[generate-sessions] Error releasing lock:", e);
      }
    }
  }
});
