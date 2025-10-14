import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { acquireLock, releaseLock, ymNowBangkok } from '../_lib/lock.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WeeklySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json().catch(() => ({}))
    const month = body?.month ?? ymNowBangkok()
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('Invalid month format. Expected YYYY-MM')
    }

    console.log(`Generating sessions for month: ${month}`)

    // Acquire lock
    const lockAcquired = await acquireLock(supabase, 'generate-sessions', month)
    if (!lockAcquired) {
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'Job already running for this month' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Get all active classes
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name, default_teacher_id, session_rate_vnd, schedule_template')
      .eq('is_active', true)

    if (classesError) throw classesError

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of month
    
    const sessionsToCreate = [];

    // Generate sessions for each class
    for (const cls of classes || []) {
      const template = cls.schedule_template as { weeklySlots: WeeklySlot[] };
      
      if (!template.weeklySlots || template.weeklySlots.length === 0) {
        console.log(`Class ${cls.name} has no weekly slots, skipping`);
        continue;
      }

      // Iterate through each day of the month
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        
        // Find matching slots for this day
        const matchingSlots = template.weeklySlots.filter(
          slot => slot.dayOfWeek === dayOfWeek
        );

        for (const slot of matchingSlots) {
          // Check if session already exists
          const dateStr = d.toISOString().split('T')[0];
          
          const { data: existing } = await supabase
            .from('sessions')
            .select('id')
            .eq('class_id', cls.id)
            .eq('date', dateStr)
            .eq('start_time', slot.startTime)
            .maybeSingle()

          if (existing) {
            console.log(`Session already exists for ${cls.name} on ${dateStr} at ${slot.startTime}`)
            continue
          }

          // Check teacher availability
          const { data: available } = await supabase.rpc(
            'check_teacher_availability',
            {
              p_teacher_id: cls.default_teacher_id,
              p_date: dateStr,
              p_start_time: slot.startTime,
              p_end_time: slot.endTime,
            }
          )

          if (!available) {
            console.log(`Teacher conflict for ${cls.name} on ${dateStr} at ${slot.startTime}`)
            continue
          }

          sessionsToCreate.push({
            class_id: cls.id,
            date: dateStr,
            start_time: slot.startTime,
            end_time: slot.endTime,
            teacher_id: cls.default_teacher_id,
            status: 'Scheduled',
          });
        }
      }
    }

    console.log(`Creating ${sessionsToCreate.length} sessions`)

    if (sessionsToCreate.length > 0) {
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert(sessionsToCreate)
        .select()

      if (insertError) throw insertError
    }

    // Guard rails: Fix status on existing sessions
    const [year, monthNum] = month.split('-').map(Number);
    const startDateStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const nextMonth = new Date(year, monthNum, 1);
    const endDateStr = nextMonth.toISOString().slice(0, 10);

    // Past Canceled stays Canceled (no change needed)
    // Future Held sessions → revert to Scheduled
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ status: 'Scheduled' })
      .gte('date', startDateStr)
      .lt('date', endDateStr)
      .eq('status', 'Held')
      .gt('date', new Date().toISOString().slice(0, 10)); // Only future dates

    if (updateError) {
      console.error('Error updating future Held sessions:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        month,
        sessionsCreated: sessionsToCreate.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error generating sessions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  } finally {
    // Always release lock
    try {
      const body = await req.clone().json().catch(() => ({}))
      const month = body?.month ?? ymNowBangkok()
      await releaseLock(supabase, 'generate-sessions', month)
    } catch (e) {
      console.error('Error releasing lock:', e)
    }
  }
})
