import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Session {
  id: string
  date: string
  status: string
  classes: {
    session_rate_vnd: number
  }
}

interface Attendance {
  status: 'Present' | 'Absent' | 'Excused'
}

interface Enrollment {
  discount_type: string | null
  discount_value: number | null
  discount_cadence: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { studentId, month } = await req.json()
    console.log('Calculating tuition for student:', studentId, 'month:', month)

    if (!studentId || !month) {
      throw new Error('Missing studentId or month')
    }

    // Get student and family info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, families(id, sibling_percent_override)')
      .eq('id', studentId)
      .single()

    if (studentError) throw studentError

    // Get sessions for the month with attendance
    const startDate = `${month}-01`
    const endDate = `${month}-31`
    
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id, discount_type, discount_value, discount_cadence')
      .eq('student_id', studentId)
      .is('end_date', null)

    const classIds = enrollments?.map(e => e.class_id) || []
    
    // Get PROJECTED sessions (Scheduled or Held) for UI display
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, date, status, classes(session_rate_vnd)')
      .in('class_id', classIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['Scheduled', 'Held'])

    console.log('Found sessions:', sessions?.length)

    // Calculate base amount from billable sessions
    let baseAmount = 0
    const sessionDetails = []

    for (const session of sessions || []) {
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('session_id', session.id)
        .eq('student_id', studentId)
        .single()

      // Billable if Present or Absent (not Excused)
      if (attendance && (attendance.status === 'Present' || attendance.status === 'Absent')) {
        const rate = (session.classes as any).session_rate_vnd
        baseAmount += rate
        sessionDetails.push({
          date: session.date,
          rate,
          status: attendance.status
        })
      }
    }

    console.log('Base amount:', baseAmount)

    // Calculate discounts
    const discounts = []
    let totalDiscount = 0

    // 1. Enrollment discount
    for (const enrollment of enrollments || []) {
      if (enrollment.discount_type && enrollment.discount_value) {
        const cadence = enrollment.discount_cadence
        if (cadence === 'monthly' || cadence === 'once') {
          const discountAmount = enrollment.discount_type === 'percent'
            ? Math.round(baseAmount * enrollment.discount_value / 100)
            : enrollment.discount_value
          
          discounts.push({
            name: 'Enrollment Discount',
            type: enrollment.discount_type,
            value: enrollment.discount_value,
            amount: discountAmount
          })
          totalDiscount += discountAmount
        }
      }
    }

    // 2. Special discounts assigned to student
    const { data: discountAssignments } = await supabase
      .from('discount_assignments')
      .select('discount_definitions(*)')
      .eq('student_id', studentId)
      .lte('effective_from', endDate)
      .or(`effective_to.is.null,effective_to.gte.${startDate}`)

    for (const assignment of discountAssignments || []) {
      const def = (assignment as any).discount_definitions
      if (def && def.is_active) {
        const discountAmount = def.type === 'percent'
          ? Math.round(baseAmount * def.value / 100)
          : def.value

        discounts.push({
          name: def.name,
          type: def.type,
          value: def.value,
          amount: discountAmount
        })
        totalDiscount += discountAmount
      }
    }

    // 3. Referral bonuses
    const { data: referralBonuses } = await supabase
      .from('referral_bonuses')
      .select('*')
      .eq('student_id', studentId)
      .lte('effective_from', endDate)
      .or(`effective_to.is.null,effective_to.gte.${startDate}`)

    for (const bonus of referralBonuses || []) {
      const discountAmount = bonus.type === 'percent'
        ? Math.round(baseAmount * bonus.value / 100)
        : bonus.value

      discounts.push({
        name: 'Referral Bonus',
        type: bonus.type,
        value: bonus.value,
        amount: discountAmount
      })
      totalDiscount += discountAmount
    }

    // 4. Sibling discount - get state and apply if assigned
    let siblingState = null
    if (student.families?.id) {
      const { data: stateData } = await supabase
        .from('sibling_discount_state')
        .select('status, winner_student_id, sibling_percent, reason')
        .eq('family_id', student.families.id)
        .eq('month', month)
        .maybeSingle()

      if (stateData) {
        siblingState = {
          status: stateData.status,
          percent: stateData.sibling_percent,
          reason: stateData.reason,
          isWinner: stateData.winner_student_id === studentId
        }

        // Only apply discount if assigned and this student is the winner
        if (stateData.status === 'assigned' && stateData.winner_student_id === studentId) {
          const siblingAmount = Math.round(baseAmount * (stateData.sibling_percent / 100))
          discounts.push({
            name: 'Sibling Discount',
            type: 'percent',
            value: stateData.sibling_percent,
            amount: siblingAmount,
            isSiblingWinner: true
          })
          totalDiscount += siblingAmount
        }
      }
    }

    const totalAmount = Math.max(0, baseAmount - totalDiscount)

    const response = {
      studentId,
      month,
      baseAmount,
      discounts,
      totalDiscount,
      totalAmount,
      sessionDetails,
      sessionCount: sessionDetails.length,
      siblingState
    }

    console.log('Tuition calculation:', response)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
