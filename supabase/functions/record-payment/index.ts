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

    // Get student's AR ledger account (not tuition - that's not a valid code)
    let { data: account, error: accountError } = await supabase
      .from('ledger_accounts')
      .select('id')
      .eq('student_id', studentId)
      .eq('code', 'AR')
      .maybeSingle();

    if (!account) {
      // Create AR ledger account if it doesn't exist
      const { data: newAccount, error: createError } = await supabase
        .from('ledger_accounts')
        .insert({
          student_id: studentId,
          code: 'AR'
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Failed to create ledger account: ${createError.message}`);
      }
      
      account = newAccount;
    }
    
    if (accountError) {
      throw new Error(`Failed to fetch ledger account: ${accountError.message}`);
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
    const paymentMonth = new Date(occurredAt).toISOString().slice(0, 7); // YYYY-MM

    // Post ledger entries (double-entry bookkeeping)
    // Credit to AR account (reduces amount owed)
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert([
        {
          tx_id: txId,
          account_id: account.id,
          credit: amount,
          debit: 0,
          month: paymentMonth,
          occurred_at: occurredAt,
          memo: `Payment received - ${method}`,
          created_by: user.id
        }
      ]);

    if (ledgerError) {
      throw new Error(`Failed to post ledger entries: ${ledgerError.message}`);
    }

    console.log('Payment recorded successfully:', payment.id);

    // Trigger tuition recalculation for this student/month
    try {
      await supabase.functions.invoke('calculate-tuition', {
        body: { studentId, month: paymentMonth }
      });
      console.log('Tuition recalculated for student:', studentId, 'month:', paymentMonth);
    } catch (tuitionError: any) {
      console.error('Failed to recalculate tuition:', tuitionError.message);
      // Don't fail the payment if tuition calc fails
    }

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
