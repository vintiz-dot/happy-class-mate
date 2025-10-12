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

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const { action, sessionId, updates } = await req.json();

    console.log('Managing session:', { action, sessionId, updates });

    if (action === 'update') {
      const { data: session, error: updateError } = await supabase
        .from('sessions')
        .update({
          ...updates,
          updated_by: user.id
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update session: ${updateError.message}`);
      }

      // Log audit
      await supabase.from('audit_log').insert({
        actor_user_id: user.id,
        entity: 'session',
        entity_id: sessionId,
        action: 'update',
        diff: updates
      });

      return new Response(
        JSON.stringify({ success: true, session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'cancel') {
      const { data: session, error: cancelError } = await supabase
        .from('sessions')
        .update({
          status: 'Canceled',
          notes: updates?.reason || 'Canceled by admin',
          updated_by: user.id
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (cancelError) {
        throw new Error(`Failed to cancel session: ${cancelError.message}`);
      }

      // Log audit
      await supabase.from('audit_log').insert({
        actor_user_id: user.id,
        entity: 'session',
        entity_id: sessionId,
        action: 'cancel',
        diff: { status: 'Canceled', reason: updates?.reason }
      });

      return new Response(
        JSON.stringify({ success: true, session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'create') {
      const { classId, date, startTime, endTime, teacherId, status = 'Scheduled' } = updates;

      // Check teacher availability
      const { data: conflicts } = await supabase
        .from('sessions')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('date', date)
        .neq('status', 'Canceled')
        .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`);

      if (conflicts && conflicts.length > 0) {
        throw new Error('Teacher has a conflicting session at this time');
      }

      const { data: session, error: createError } = await supabase
        .from('sessions')
        .insert({
          class_id: classId,
          teacher_id: teacherId,
          date,
          start_time: startTime,
          end_time: endTime,
          status,
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create session: ${createError.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    console.error('Error managing session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});