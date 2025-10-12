import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { month, teacherId } = await req.json()
    console.log('Calculating payroll for month:', month, 'teacher:', teacherId)

    if (!month) {
      throw new Error('Missing month parameter')
    }

    const startDate = `${month}-01`
    const endDate = `${month}-31`

    // Build query - get all teachers or specific one
    let teachersQuery = supabase
      .from('teachers')
      .select('id, full_name, hourly_rate_vnd, user_id')
      .eq('is_active', true)

    if (teacherId) {
      teachersQuery = teachersQuery.eq('id', teacherId)
    }

    const { data: teachers, error: teachersError } = await teachersQuery

    if (teachersError) throw teachersError

    const payrollData = []

    for (const teacher of teachers || []) {
      // Get all Held sessions for this teacher in the month
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, date, start_time, end_time')
        .eq('teacher_id', teacher.id)
        .eq('status', 'Held')
        .gte('date', startDate)
        .lte('date', endDate)

      if (sessionsError) throw sessionsError

      let totalMinutes = 0
      const sessionDetails = []

      for (const session of sessions || []) {
        // Calculate minutes for this session
        const start = new Date(`${session.date}T${session.start_time}`)
        const end = new Date(`${session.date}T${session.end_time}`)
        const minutes = (end.getTime() - start.getTime()) / (1000 * 60)

        totalMinutes += minutes
        sessionDetails.push({
          date: session.date,
          start_time: session.start_time,
          end_time: session.end_time,
          minutes: Math.round(minutes)
        })
      }

      const totalHours = totalMinutes / 60
      const totalAmount = Math.round((totalMinutes / 60) * teacher.hourly_rate_vnd)

      payrollData.push({
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        hourlyRate: teacher.hourly_rate_vnd,
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalMinutes: Math.round(totalMinutes),
        totalAmount,
        sessionsCount: sessions?.length || 0,
        sessionDetails
      })

      // Upsert payroll summary
      await supabase
        .from('payroll_summaries')
        .upsert(
          {
            teacher_id: teacher.id,
            month,
            total_hours: parseFloat(totalHours.toFixed(2)),
            total_amount: totalAmount,
            sessions_count: sessions?.length || 0
          },
          { onConflict: 'teacher_id,month', ignoreDuplicates: false }
        )
    }

    console.log('Payroll calculated:', payrollData)

    return new Response(
      JSON.stringify({
        month,
        payrollData,
        totalTeachers: payrollData.length,
        grandTotal: payrollData.reduce((sum, p) => sum + p.totalAmount, 0)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
