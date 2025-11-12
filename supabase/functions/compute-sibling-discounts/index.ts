import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { acquireLock, releaseLock, ymNowBangkok } from '../_lib/lock.ts'
import { tieHash } from '../_lib/hash.ts'
import { getHighestClassPerStudent } from '../_lib/projected-per-class.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SiblingDiscountRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format").optional(),
  dryRun: z.boolean().optional().default(false),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization (admin only)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => r.role === 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input validation
    const body = await req.json().catch(() => ({}))
    const validationResult = SiblingDiscountRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input', 
        details: validationResult.error.issues 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const month = validationResult.data.month ?? ymNowBangkok()
    const dryRun = validationResult.data.dryRun ?? false
    
    console.log('Computing sibling discounts for month:', month, 'dryRun:', dryRun)

    // Acquire lock (skip in dry run mode)
    let lockAcquired = true
    if (!dryRun) {
      lockAcquired = await acquireLock(supabase, 'compute-sibling-discounts', month)
      if (!lockAcquired) {
        return new Response(JSON.stringify({ 
          success: false, 
          reason: 'Job already running for this month' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
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
          if (!dryRun) {
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
          }
          
          results.push({ 
            family_id: family.id, 
            status: 'none', 
            reason: 'insufficient students',
            student_count: students?.length || 0
          })
          continue
        }

        // Get highest-tuition class per student
        const highestPerStudent = await getHighestClassPerStudent(supabase, family.id, month)
        console.log(`Family ${family.id} highest classes per student:`, highestPerStudent)

        // Filter students with positive tuition in their highest class
        const positives = highestPerStudent.filter((r: any) => r.projected_base > 0)

        if (positives.length < 2) {
          // Threshold not met
          const percent = family.sibling_percent_override ?? 5
          if (!dryRun) {
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
          }

          results.push({ 
            family_id: family.id, 
            status: 'pending', 
            reason: 'threshold not met',
            positive_count: positives.length,
            students_data: positives
          })
          continue
        }

        // Select winner: sibling with LOWEST highest-tuition class with deterministic tie-break
        const percent = family.sibling_percent_override ?? 5
        positives.sort((a: any, b: any) => {
          if (a.projected_base !== b.projected_base) {
            return a.projected_base - b.projected_base // Sort ASCENDING - lowest first
          }
          // Tie-breaker: hash(familyId+month) XOR hash(studentId), then student_id
          const hashA = tieHash(family.id + month) ^ tieHash(String(a.student_id))
          const hashB = tieHash(family.id + month) ^ tieHash(String(b.student_id))
          if (hashA !== hashB) return hashA - hashB
          return String(a.student_id) < String(b.student_id) ? -1 : 1
        })

        const winner = positives[0]

        // Check if status was previously pending (for retroactive application)
        let wasPending = false
        if (!dryRun) {
          const { data: existingState } = await supabase
            .from('sibling_discount_state')
            .select('status, winner_student_id')
            .eq('family_id', family.id)
            .eq('month', month)
            .maybeSingle()

          wasPending = existingState?.status === 'pending'

          await supabase
            .from('sibling_discount_state')
            .upsert({
              family_id: family.id,
              month,
              status: 'assigned',
              winner_student_id: winner.student_id,
              winner_class_id: winner.class_id,
              sibling_percent: percent,
              projected_base_snapshot: winner.projected_base,
              reason: `Winner: ${winner.class_name} - lowest highest-tuition (${winner.projected_base.toLocaleString('vi-VN')} ₫)`,
              computed_at: new Date().toISOString()
            })
        }

        const discountAmount = Math.round(winner.projected_base * (percent / 100))

        results.push({ 
          family_id: family.id, 
          status: 'assigned',
          winner_student_id: winner.student_id,
          winner_class_id: winner.class_id,
          winner_class_name: winner.class_name,
          winner_base: winner.projected_base,
          discount_percent: percent,
          discount_amount: discountAmount,
          retroactive: wasPending,
          all_students: positives.map((p: any) => ({
            student_id: p.student_id,
            class_id: p.class_id,
            class_name: p.class_name,
            projected_base: p.projected_base,
            is_winner: p.student_id === winner.student_id
          }))
        })

        console.log(`Assigned sibling discount to student ${winner.student_id} (${winner.projected_base})`)
      }

      return new Response(JSON.stringify({ 
        success: true, 
        dryRun,
        month,
        processed: families?.length || 0,
        results 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } finally {
      // Release lock (only if not dry run)
      if (!dryRun) {
        await releaseLock(supabase, 'compute-sibling-discounts', month)
      }
    }
  } catch (error) {
    console.error('Sibling discount computation error:', error)
    
    // Don't expose internal errors to client
    return new Response(JSON.stringify({ 
      error: 'Failed to compute sibling discounts',
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})