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

    // Verify admin role
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

    // Export all tables
    const tables = [
      'families', 'students', 'teachers', 'classes', 'enrollments',
      'sessions', 'attendance', 'homeworks', 'homework_files',
      'ledger_accounts', 'ledger_entries', 'sibling_discount_state',
      'bank_info', 'audit_log', 'payments', 'invoices',
      'discount_definitions', 'discount_assignments', 'referral_bonuses',
      'payroll_summaries'
    ];

    const result: any = {
      exported_at: new Date().toISOString(),
      tables: {}
    };

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*');
      if (!error && data) {
        result.tables[table] = data;
      }
    }

    // Log export action
    await supabase.from('audit_log').insert({
      action: 'admin_data_export',
      entity: 'system',
      actor_user_id: user.id,
      diff: { tables_exported: Object.keys(result.tables), count: Object.keys(result.tables).length }
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="happy-english-export-${new Date().toISOString().split('T')[0]}.json"`
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
