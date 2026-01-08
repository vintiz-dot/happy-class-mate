import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_lib/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AttendanceRequestSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  studentId: z.string().uuid("Invalid student ID"),
  status: z.enum(['Present', 'Absent', 'Excused', 'Late']),
  notes: z.string().max(500, "Notes too long").optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit by IP
    const clientIP = getClientIP(req);
    const ipLimit = checkRateLimit(clientIP, 60, 60000, 'ip');
    
    if (ipLimit.limited) {
      return rateLimitResponse(ipLimit.resetAt, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit by user
    const userLimit = checkRateLimit(user.id, 40, 60000, 'user');
    
    if (userLimit.limited) {
      return rateLimitResponse(userLimit.resetAt, corsHeaders);
    }

    // Check if user is admin or teacher
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => ['admin', 'teacher'].includes(r.role))) {
      return new Response(JSON.stringify({ error: 'Admin or teacher access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input validation
    const requestBody = await req.json();
    const validationResult = AttendanceRequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid input", 
        details: validationResult.error.issues 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, studentId, status, notes } = validationResult.data;

    console.log('Marking attendance:', { sessionId, studentId, status });

    // Upsert attendance record
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .upsert({
        session_id: sessionId,
        student_id: studentId,
        status,
        notes,
        marked_by: user.id,
        marked_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,student_id'
      })
      .select()
      .single();

    if (attendanceError) {
      throw new Error(`Failed to mark attendance: ${attendanceError.message}`);
    }

    // Auto-mark session as Held when attendance is marked (only if currently Scheduled)
    await supabase
      .from('sessions')
      .update({ status: 'Held' })
      .eq('id', sessionId)
      .eq('status', 'Scheduled');

    console.log('Attendance marked successfully:', attendance.id);

    // Trigger tuition recalculation if status is Absent or Excused
    if (status === 'Absent' || status === 'Excused') {
      console.log('Triggering tuition recalculation for student:', studentId);
      
      // Get session date to determine month
      const { data: session } = await supabase
        .from('sessions')
        .select('date')
        .eq('id', sessionId)
        .single();
      
      if (session) {
        const month = session.date.substring(0, 7); // YYYY-MM format
        
        // Call calculate-tuition edge function
        const { error: calcError } = await supabase.functions.invoke('calculate-tuition', {
          body: { studentId, month }
        });
        
        if (calcError) {
          console.error('Error recalculating tuition:', calcError);
        } else {
          console.log('Tuition recalculated successfully');
        }
      }
    }

    // Track attendance streak for "Present" status and award 50 XP bonus for every 5 consecutive classes
    if (status === 'Present') {
      try {
        // Get session's class_id
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('class_id')
          .eq('id', sessionId)
          .single();

        if (sessionData?.class_id) {
          const classId = sessionData.class_id;

          // Get or create attendance streak record
          const { data: existingStreak } = await supabase
            .from('student_attendance_streaks')
            .select('*')
            .eq('student_id', studentId)
            .eq('class_id', classId)
            .maybeSingle();

          let newConsecutive = 1;
          let bonusesAwarded = existingStreak?.bonuses_awarded || 0;

          if (existingStreak) {
            // Check if this is consecutive (based on last attendance)
            // For simplicity, we increment if last attendance was within reasonable time
            const lastDate = existingStreak.last_attendance_date;
            const today = new Date().toISOString().split('T')[0];
            
            // If last attendance was not today (prevent double counting same day)
            if (lastDate !== today) {
              newConsecutive = (existingStreak.consecutive_days || 0) + 1;
            } else {
              newConsecutive = existingStreak.consecutive_days || 1;
            }
          }

          // Check if we've reached a 5-class milestone
          const previousMilestones = bonusesAwarded;
          const currentMilestones = Math.floor(newConsecutive / 5);

          if (currentMilestones > previousMilestones) {
            // Award 50 XP as focus points
            console.log(`Awarding 50 XP focus bonus for ${newConsecutive} consecutive classes`);
            
            await supabase
              .from('point_transactions')
              .insert({
                student_id: studentId,
                class_id: classId,
                points: 50,
                type: 'focus',
                reason: `Attendance streak bonus: ${newConsecutive} consecutive classes attended!`
              });

            bonusesAwarded = currentMilestones;
          }

          // Update streak record
          const today = new Date().toISOString().split('T')[0];
          await supabase
            .from('student_attendance_streaks')
            .upsert({
              student_id: studentId,
              class_id: classId,
              consecutive_days: newConsecutive,
              last_attendance_date: today,
              bonuses_awarded: bonusesAwarded,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'student_id,class_id'
            });

          console.log(`Updated attendance streak: ${newConsecutive} consecutive classes`);
        }
      } catch (streakError) {
        // Don't fail the main attendance marking if streak tracking fails
        console.error('Error tracking attendance streak:', streakError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, attendance }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error marking attendance:', error);
    
    // Don't expose internal errors to client
    return new Response(
      JSON.stringify({ error: 'Failed to mark attendance' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});