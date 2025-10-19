import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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