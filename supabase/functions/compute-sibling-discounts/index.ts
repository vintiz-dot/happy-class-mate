import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hash function for deterministic tie-breaking
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

interface StudentProjection {
  id: string
  projected_base: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { month } = await req.json()
    console.log('Computing sibling discounts for month:', month)

    if (!month) {
      throw new Error('Missing month parameter')
    }

    const startDate = `${month}-01`
    const endDate = `${month}-31`

    // Get all active families
    const { data: families, error: familiesError } = await supabase
      .from('families')
      .select('id, sibling_percent_override')
      .eq('is_active', true)

    if (familiesError) throw familiesError

    const results = []

    for (const family of families || []) {
      console.log(`Processing family ${family.id}`)

      // Get all active students in family
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('family_id', family.id)
        .eq('is_active', true)

      if (studentsError) throw studentsError

      if (!students || students.length < 2) {
        // Less than 2 students - no sibling discount possible
        await supabase
          .from('sibling_discount_state')
          .upsert({
            family_id: family.id,
            month,
            status: 'none',
            winner_student_id: null,
            sibling_percent: family.sibling_percent_override || 5,
            reason: `Family has ${students?.length || 0} student(s), need ≥2`,
            computed_at: new Date().toISOString()
          })
        
        results.push({ family_id: family.id, status: 'none', reason: 'insufficient students' })
        continue
      }

      // Calculate projected tuition for each student
      const studentProjections: StudentProjection[] = []

      for (const student of students) {
        // Get enrollments
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('class_id, start_date, end_date')
          .eq('student_id', student.id)
          .lte('start_date', endDate)
          .or(`end_date.is.null,end_date.gte.${startDate}`)

        if (!enrollments || enrollments.length === 0) {
          studentProjections.push({ id: student.id, projected_base: 0 })
          continue
        }

        const classIds = enrollments.map(e => e.class_id)

        // Get PROJECTED sessions (Scheduled + Held)
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, date, status, class_id, classes(session_rate_vnd)')
          .in('class_id', classIds)
          .gte('date', startDate)
          .lte('date', endDate)
          .in('status', ['Scheduled', 'Held'])

        let projected_base = 0

        for (const session of sessions || []) {
          // Check if session is within enrollment window
          const enrollment = enrollments.find(e => 
            e.class_id === session.class_id &&
            session.date >= e.start_date &&
            (!e.end_date || session.date <= e.end_date)
          )

          if (enrollment) {
            const rate = (session.classes as any).session_rate_vnd
            projected_base += rate
          }
        }

        studentProjections.push({ id: student.id, projected_base })
      }

      console.log(`Family ${family.id} projections:`, studentProjections)

      // Filter students with positive tuition
      const positiveStudents = studentProjections.filter(s => s.projected_base > 0)

      if (positiveStudents.length < 2) {
        // Threshold not met
        await supabase
          .from('sibling_discount_state')
          .upsert({
            family_id: family.id,
            month,
            status: 'pending',
            winner_student_id: null,
            sibling_percent: family.sibling_percent_override || 5,
            reason: `Only ${positiveStudents.length} student(s) with positive tuition, need ≥2`,
            computed_at: new Date().toISOString()
          })

        results.push({ 
          family_id: family.id, 
          status: 'pending', 
          reason: 'threshold not met',
          positive_count: positiveStudents.length
        })
        continue
      }

      // Select winner: lowest positive projected base
      positiveStudents.sort((a, b) => {
        if (a.projected_base !== b.projected_base) {
          return a.projected_base - b.projected_base
        }
        // Tie-breaker: hash(familyId+month), then student.id
        const hashA = hashString(family.id + month + a.id)
        const hashB = hashString(family.id + month + b.id)
        if (hashA !== hashB) return hashA - hashB
        return a.id.localeCompare(b.id)
      })

      const winner = positiveStudents[0]
      const siblingPercent = family.sibling_percent_override || 5

      // Check if status was previously pending (for retroactive application)
      const { data: existingState } = await supabase
        .from('sibling_discount_state')
        .select('status, winner_student_id')
        .eq('family_id', family.id)
        .eq('month', month)
        .single()

      const wasAssigned = existingState?.status === 'assigned'
      const wasPending = existingState?.status === 'pending'

      await supabase
        .from('sibling_discount_state')
        .upsert({
          family_id: family.id,
          month,
          status: 'assigned',
          winner_student_id: winner.id,
          sibling_percent: siblingPercent,
          reason: `Winner: lowest positive projected base (${winner.projected_base.toLocaleString('vi-VN')} ₫)`,
          computed_at: new Date().toISOString()
        })

      results.push({ 
        family_id: family.id, 
        status: 'assigned',
        winner_student_id: winner.id,
        winner_base: winner.projected_base,
        retroactive: wasPending && !wasAssigned
      })

      console.log(`Assigned sibling discount to student ${winner.id} (${winner.projected_base})`)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      month,
      processed: families?.length || 0,
      results 
    }), {
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