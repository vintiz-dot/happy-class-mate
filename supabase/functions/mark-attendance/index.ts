import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin or teacher
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'teacher'].includes(roleData.role)) {
      throw new Error('Unauthorized: Admin or Teacher access required');
    }

    const { sessionId, studentId, status, notes } = await req.json();

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});