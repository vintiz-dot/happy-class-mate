import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { acquireLock, releaseLock, ymNowBangkok } from '../_lib/lock.ts'
import { tieHash } from '../_lib/hash.ts'
import { projectedByFamily } from '../_lib/projected.ts'

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

    const body = await req.json().catch(() => ({}))
    const month = body?.month ?? ymNowBangkok()
    
    console.log('Computing sibling discounts for month:', month)

    // Acquire lock
    const lockAcquired = await acquireLock(supabase, 'compute-sibling-discounts', month)
    if (!lockAcquired) {
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'Job already running for this month' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    try {
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
              projected_base_snapshot: null,
              reason: `Family has ${students?.length || 0} student(s), need ≥2`,
              computed_at: new Date().toISOString()
            })
          
          results.push({ family_id: family.id, status: 'none', reason: 'insufficient students' })
          continue
        }

        // Get projected bases using the view
        const baseRows = await projectedByFamily(supabase, family.id, month)
        console.log(`Family ${family.id} projections:`, baseRows)

        // Filter students with positive tuition
        const positives = baseRows.filter((r: any) => r.projected_base > 0)

        if (positives.length < 2) {
          // Threshold not met
          const percent = family.sibling_percent_override ?? 5
          await supabase
            .from('sibling_discount_state')
            .upsert({
              family_id: family.id,
              month,
              status: 'pending',
              winner_student_id: null,
              sibling_percent: percent,
              projected_base_snapshot: null,
              reason: `Only ${positives.length} student(s) with positive tuition, need ≥2`,
              computed_at: new Date().toISOString()
            })

          results.push({ 
            family_id: family.id, 
            status: 'pending', 
            reason: 'threshold not met',
            positive_count: positives.length
          })
          continue
        }

        // Select winner: lowest positive projected base with deterministic tie-break
        const percent = family.sibling_percent_override ?? 5
        positives.sort((a: any, b: any) => {
          if (a.projected_base !== b.projected_base) {
            return a.projected_base - b.projected_base
          }
          // Tie-breaker: hash(familyId+month) XOR hash(studentId), then student_id
          const hashA = tieHash(family.id + month) ^ tieHash(String(a.student_id))
          const hashB = tieHash(family.id + month) ^ tieHash(String(b.student_id))
          if (hashA !== hashB) return hashA - hashB
          return String(a.student_id) < String(b.student_id) ? -1 : 1
        })

        const winner = positives[0]

        // Check if status was previously pending (for retroactive application)
        const { data: existingState } = await supabase
          .from('sibling_discount_state')
          .select('status, winner_student_id')
          .eq('family_id', family.id)
          .eq('month', month)
          .maybeSingle()

        const wasPending = existingState?.status === 'pending'

        await supabase
          .from('sibling_discount_state')
          .upsert({
            family_id: family.id,
            month,
            status: 'assigned',
            winner_student_id: winner.student_id,
            sibling_percent: percent,
            projected_base_snapshot: winner.projected_base,
            reason: `Winner: lowest positive projected base (${winner.projected_base.toLocaleString('vi-VN')} ₫)`,
            computed_at: new Date().toISOString()
          })

        results.push({ 
          family_id: family.id, 
          status: 'assigned',
          winner_student_id: winner.student_id,
          winner_base: winner.projected_base,
          retroactive: wasPending
        })

        console.log(`Assigned sibling discount to student ${winner.student_id} (${winner.projected_base})`)
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
    } finally {
      // Release lock
      await releaseLock(supabase, 'compute-sibling-discounts', month)
    }
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})