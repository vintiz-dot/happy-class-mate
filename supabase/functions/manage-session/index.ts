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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const { action, data } = await req.json();

    if (action === 'update') {
      const { id, teacher_id, rate_override_vnd, status, notes } = data;
      const { data: oldSession } = await supabase.from('sessions').select('*').eq('id', id).single();

      const { error } = await supabase.from('sessions').update({
        teacher_id: teacher_id !== undefined ? teacher_id : oldSession?.teacher_id,
        rate_override_vnd: rate_override_vnd !== undefined ? rate_override_vnd : oldSession?.rate_override_vnd,
        status: status || oldSession?.status,
        notes: notes !== undefined ? notes : oldSession?.notes,
        updated_by: user.id,
      }).eq('id', id);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        action: 'session_update',
        entity: 'sessions',
        entity_id: id,
        actor_user_id: user.id,
        diff: { before: oldSession, after: data }
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'cancel') {
      const { id, reason } = data;
      const { data: session } = await supabase.from('sessions').select('status').eq('id', id).single();
      
      if (session?.status === 'Held') {
        return new Response(JSON.stringify({ error: 'Cannot cancel past Held sessions' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.from('sessions').update({
        status: 'Canceled',
        canceled_reason: reason,
        canceled_by: user.id,
        canceled_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', id);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        action: 'session_cancel',
        entity: 'sessions',
        entity_id: id,
        actor_user_id: user.id,
        diff: { reason }
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'bulk-delete') {
      const { class_id, teacher_id, from_date, to_date, hard_delete = false } = data;
      
      let query = supabase.from('sessions').select('*');
      
      if (class_id) query = query.eq('class_id', class_id);
      if (teacher_id) query = query.eq('teacher_id', teacher_id);
      if (from_date) query = query.gte('date', from_date);
      if (to_date) query = query.lte('date', to_date);
      
      const { data: sessions, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Prevent deletion of past Held sessions
      const today = new Date().toISOString().split('T')[0];
      const sessionsToProcess = sessions?.filter(s => {
        if (s.status === 'Held' && s.date < today) {
          return false; // Skip past Held sessions
        }
        return true;
      }) || [];

      if (hard_delete) {
        // Hard delete
        const ids = sessionsToProcess.map(s => s.id);
        if (ids.length > 0) {
          const { error } = await supabase.from('sessions').delete().in('id', ids);
          if (error) throw error;
        }
        
        await supabase.from('audit_log').insert({
          action: 'session_bulk_hard_delete',
          entity: 'sessions',
          actor_user_id: user.id,
          diff: { count: ids.length, ids, criteria: { class_id, teacher_id, from_date, to_date } }
        });

        return new Response(JSON.stringify({ 
          ok: true, 
          deleted: ids.length,
          skipped: (sessions?.length || 0) - ids.length 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Soft delete (cancel)
        const ids = sessionsToProcess.map(s => s.id);
        if (ids.length > 0) {
          const { error } = await supabase.from('sessions').update({
            status: 'Canceled',
            canceled_reason: 'Bulk cancellation',
            canceled_by: user.id,
            canceled_at: new Date().toISOString(),
          }).in('id', ids);
          if (error) throw error;
        }

        await supabase.from('audit_log').insert({
          action: 'session_bulk_cancel',
          entity: 'sessions',
          actor_user_id: user.id,
          diff: { count: ids.length, criteria: { class_id, teacher_id, from_date, to_date } }
        });

        return new Response(JSON.stringify({ 
          ok: true, 
          canceled: ids.length,
          skipped: (sessions?.length || 0) - ids.length 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'delete') {
      const { id } = data;
      const { data: oldSession } = await supabase.from('sessions').select('*').eq('id', id).single();
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        action: 'session_delete',
        entity: 'sessions',
        entity_id: id,
        actor_user_id: user.id,
        diff: { deleted: oldSession }
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const { class_id, date, start_time, end_time, teacher_id, rate_override_vnd, notes, status } = data;

      const { data: newSession, error } = await supabase.from('sessions').insert({
        class_id, date, start_time, end_time, teacher_id,
        rate_override_vnd: rate_override_vnd || null,
        notes: notes || null,
        status: status || 'Scheduled',
        created_by: user.id,
      }).select().single();

      if (error) throw error;

      await supabase.from('audit_log').insert({
        action: 'session_create',
        entity: 'sessions',
        entity_id: newSession.id,
        actor_user_id: user.id,
        diff: { created: newSession }
      });

      return new Response(JSON.stringify({ ok: true, session: newSession }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Session management error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
