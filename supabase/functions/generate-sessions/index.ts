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
  teacherId?: string; // Optional teacher override per slot
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
  let revertResult: any = null;

  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error("Invalid month format. Expected YYYY-MM");
    }

    console.log(`[generate-sessions] Generating sessions for month: ${month}`);

    // ALWAYS revert invalid held sessions first (even if lock not acquired)
    // This ensures cleanup happens on every invocation
    console.log(`[generate-sessions] Calling revert with month=${month}, today=${todayBkk}, now=${nowBkkHHMM}`);
    
    const { data: preRevertResult, error: preRevertError } = await supabase.rpc(
      "revert_invalid_held_sessions",
      {
        p_month: month,
        p_today: todayBkk,
        p_now: nowBkkHHMM,
      }
    );

    if (preRevertError) {
      console.error("[generate-sessions] Error in pre-lock revert:", preRevertError);
      // Don't fail the entire function if revert fails - log and continue
    } else {
      revertResult = preRevertResult;
      console.log(`[generate-sessions] Pre-lock revert completed:`, preRevertResult);
    }

    // Acquire lock
    lockAcquired = await acquireLock(supabase, "generate-sessions", month);
    if (!lockAcquired) {
      console.log(`[generate-sessions] Lock already held, returning early with revert results`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Job already running for this month",
          reverted: revertResult || { totalReverted: 0 },
          today: todayBkk,
          now: nowBkkHHMM,
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
    const sessionsToDelete: string[] = [];

    // Generate sessions intelligently
    for (const cls of classes || []) {
      const template = cls.schedule_template as { weeklySlots: WeeklySlot[] } | null;
      if (!template?.weeklySlots?.length) {
        console.log(`Class ${cls.name} has no weekly slots, skipping`);
        continue;
      }

      // Get existing non-canceled sessions (both Scheduled and Held) for this class in this month
      const { data: existingSessions, error: existingErr } = await supabase
        .from("sessions")
        .select("id, date, start_time, end_time, teacher_id, status")
        .eq("class_id", cls.id)
        .neq("status", "Canceled")
        .gte("date", fmtDateYMD(startDate))
        .lte("date", fmtDateYMD(endDate));
      
      if (existingErr) throw existingErr;

      // Build a map of what SHOULD exist based on template
      const expectedSessions = new Map<string, { slot: WeeklySlot, teacherId: string }>();
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const dateStr = fmtDateYMD(d);
        const matchingSlots = template.weeklySlots.filter((s) => s.dayOfWeek === dayOfWeek);
        
        for (const slot of matchingSlots) {
          const assignedTeacherId = slot.teacherId || cls.default_teacher_id;
          const key = `${dateStr}|${slot.startTime}`;
          expectedSessions.set(key, { slot, teacherId: assignedTeacherId });
        }
      }

      // Check existing sessions - delete ones that don't match template anymore
      for (const session of existingSessions || []) {
        const key = `${session.date}|${session.start_time}`;
        const expected = expectedSessions.get(key);
        
        // Only modify SCHEDULED sessions - Held sessions are historical and should not be changed
        if (session.status === 'Scheduled') {
          // Delete if session no longer in template OR teacher has changed
          if (!expected || expected.teacherId !== session.teacher_id) {
            sessionsToDelete.push(session.id);
            const reason = !expected 
              ? '(no longer in template)' 
              : `(teacher changed from ${session.teacher_id} to ${expected.teacherId})`;
            console.log(`Marking for deletion: ${cls.name} on ${session.date} at ${session.start_time} ${reason}`);
          }
        } else if (session.status === 'Held' && expected && expected.teacherId !== session.teacher_id) {
          // Log warning for past Held sessions with wrong teacher (audit purposes)
          console.log(`⚠️ Audit: Held session has wrong teacher - ${cls.name} on ${session.date} at ${session.start_time} (has ${session.teacher_id}, should be ${expected.teacherId})`);
        }
      }

      // Create sessions that should exist but don't
      for (const [key, { slot, teacherId }] of expectedSessions) {
        const [dateStr, startTime] = key.split('|');
        
        // Check if session already exists (either with correct teacher, or as a Held session)
        // Don't create duplicates if a Held session exists, even with wrong teacher
        const exists = (existingSessions || []).some(
          s => s.date === dateStr && s.start_time === startTime && 
               (s.teacher_id === teacherId || s.status === 'Held')
        );
        
        if (exists) continue;

        // Use teacherId from map (already resolved from slot or default)
        const assignedTeacherId = teacherId;

        // Teacher availability check
        const { data: available, error: availErr } = await supabase.rpc("check_teacher_availability", {
          p_teacher_id: assignedTeacherId,
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
          teacher_id: assignedTeacherId,
          status: "Scheduled",
        });
      }
    }

    // Delete obsolete sessions first
    if (sessionsToDelete.length > 0) {
      console.log(`[generate-sessions] Deleting ${sessionsToDelete.length} obsolete sessions`);
      const { error: deleteError } = await supabase
        .from("sessions")
        .delete()
        .in("id", sessionsToDelete);
      if (deleteError) throw deleteError;
    }

    console.log(`[generate-sessions] Creating ${sessionsToCreate.length} sessions`);
    if (sessionsToCreate.length > 0) {
      const { error: insertError } = await supabase.from("sessions").insert(sessionsToCreate);
      if (insertError) throw insertError;
    }

    // Call database function again to revert any sessions that may have been created with wrong status
    console.log(`[generate-sessions] Post-insert revert with month=${month}, today=${todayBkk}, now=${nowBkkHHMM}`);
    
    const { data: postRevertResult, error: postRevertError } = await supabase.rpc(
      "revert_invalid_held_sessions",
      {
        p_month: month,
        p_today: todayBkk,
        p_now: nowBkkHHMM,
      }
    );

    if (postRevertError) {
      console.error("[generate-sessions] Error in post-insert revert:", postRevertError);
      // Don't fail the entire function - log and continue
    } else {
      revertResult = postRevertResult;
      console.log(`[generate-sessions] Post-insert revert completed:`, postRevertResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        month,
        sessionsCreated: sessionsToCreate.length,
        sessionsDeleted: sessionsToDelete.length,
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
