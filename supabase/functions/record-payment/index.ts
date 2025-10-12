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

    const { studentId, amount, method, occurredAt, payerName, memo } = await req.json();

    console.log('Recording payment:', { studentId, amount, method, occurredAt });

    // Get student's ledger account
    const { data: account, error: accountError } = await supabase
      .from('ledger_accounts')
      .select('id')
      .eq('student_id', studentId)
      .eq('code', 'tuition')
      .single();

    if (accountError || !account) {
      // Create ledger account if it doesn't exist
      const { data: newAccount, error: createError } = await supabase
        .from('ledger_accounts')
        .insert({
          student_id: studentId,
          code: 'tuition'
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Failed to create ledger account: ${createError.message}`);
      }
    }

    // Record payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        student_id: studentId,
        amount,
        method,
        occurred_at: occurredAt,
        memo: memo || `Payment by ${payerName || 'Unknown'}`,
        created_by: user.id
      })
      .select()
      .single();

    if (paymentError) {
      throw new Error(`Failed to record payment: ${paymentError.message}`);
    }

    // Generate unique tx_id for double-entry
    const txId = crypto.randomUUID();
    const month = new Date(occurredAt).toISOString().slice(0, 7); // YYYY-MM

    // Post ledger entries (double-entry bookkeeping)
    // Credit to tuition account (reduces amount owed)
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert([
        {
          tx_id: txId,
          account_id: account?.id,
          credit: amount,
          debit: 0,
          month,
          occurred_at: occurredAt,
          memo: `Payment received - ${method}`,
          created_by: user.id
        }
      ]);

    if (ledgerError) {
      throw new Error(`Failed to post ledger entries: ${ledgerError.message}`);
    }

    console.log('Payment recorded successfully:', payment.id);

    return new Response(
      JSON.stringify({ success: true, paymentId: payment.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
