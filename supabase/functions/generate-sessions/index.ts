import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklySlot {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { month } = await req.json(); // Format: YYYY-MM
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('Invalid month format. Expected YYYY-MM');
    }

    console.log(`Generating sessions for month: ${month}`);

    // Get all active classes
    const { data: classes, error: classesError } = await supabaseClient
      .from('classes')
      .select('id, name, default_teacher_id, session_rate_vnd, schedule_template')
      .eq('is_active', true);

    if (classesError) throw classesError;

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
          
          const { data: existing } = await supabaseClient
            .from('sessions')
            .select('id')
            .eq('class_id', cls.id)
            .eq('date', dateStr)
            .eq('start_time', slot.startTime)
            .maybeSingle();

          if (existing) {
            console.log(`Session already exists for ${cls.name} on ${dateStr} at ${slot.startTime}`);
            continue;
          }

          // Check teacher availability
          const { data: available } = await supabaseClient.rpc(
            'check_teacher_availability',
            {
              p_teacher_id: cls.default_teacher_id,
              p_date: dateStr,
              p_start_time: slot.startTime,
              p_end_time: slot.endTime,
            }
          );

          if (!available) {
            console.log(`Teacher conflict for ${cls.name} on ${dateStr} at ${slot.startTime}`);
            continue;
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

    console.log(`Creating ${sessionsToCreate.length} sessions`);

    if (sessionsToCreate.length > 0) {
      const { data, error: insertError } = await supabaseClient
        .from('sessions')
        .insert(sessionsToCreate)
        .select();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          sessionsCreated: data?.length || 0,
          sessions: data,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionsCreated: 0,
        message: 'No new sessions to create',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error generating sessions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
