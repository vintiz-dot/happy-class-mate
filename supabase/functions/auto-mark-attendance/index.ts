import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Auto-mark attendance for today's sessions at 10 PM Bangkok time
 * Sets status to 'Present' if attendance hasn't been marked by teacher or admin
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get current date in Bangkok timezone
    const bangkokDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
    const today = new Date(bangkokDate).toISOString().slice(0, 10) // YYYY-MM-DD

    console.log(`Auto-marking attendance for date: ${today}`)

    // Get all sessions for today that are Scheduled or Held
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, class_id, status')
      .eq('date', today)
      .in('status', ['Scheduled', 'Held'])

    if (sessionsError) throw sessionsError

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for today')
      return new Response(
        JSON.stringify({ message: 'No sessions to process', date: today }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Found ${sessions.length} sessions for today`)

    let totalMarked = 0

    for (const session of sessions) {
      // Get enrolled students for this class who were enrolled on this date
      const { data: enrollments, error: enrollErr } = await supabase
        .from('enrollments')
        .select('student_id, start_date, end_date')
        .eq('class_id', session.class_id)
        .lte('start_date', today) // enrolled on or before session date
        .or(`end_date.is.null,end_date.gte.${today}`) // still enrolled on session date

      if (enrollErr) {
        console.error(`Error getting enrollments for session ${session.id}:`, enrollErr)
        continue
      }

      if (!enrollments || enrollments.length === 0) continue

      // Get existing attendance records for this session
      const { data: existingAttendance, error: attErr } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('session_id', session.id)

      if (attErr) {
        console.error(`Error getting attendance for session ${session.id}:`, attErr)
        continue
      }

      const markedStudents = new Set((existingAttendance || []).map(a => a.student_id))

      // Filter to only students actually enrolled on this date
      const validEnrollments = (enrollments || []).filter(e => 
        e.start_date <= today && (!e.end_date || e.end_date >= today)
      )

      // Create attendance records for students without attendance (default to Present)
      const newAttendanceRecords = validEnrollments
        .filter(e => !markedStudents.has(e.student_id))
        .map(e => ({
          session_id: session.id,
          student_id: e.student_id,
          status: 'Present',
          marked_by: null, // System-marked
          marked_at: new Date().toISOString(),
        }))

      if (newAttendanceRecords.length > 0) {
        const { error: insertErr } = await supabase
          .from('attendance')
          .insert(newAttendanceRecords)

        if (insertErr) {
          console.error(`Error inserting attendance for session ${session.id}:`, insertErr)
          continue
        }

        totalMarked += newAttendanceRecords.length
        console.log(`Marked ${newAttendanceRecords.length} students as Present for session ${session.id}`)
      }
    }

    console.log(`Total attendance records created: ${totalMarked}`)

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        sessionsProcessed: sessions.length,
        attendanceMarked: totalMarked,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error in auto-mark-attendance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
