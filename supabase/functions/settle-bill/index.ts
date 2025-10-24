import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) throw new Error('Unauthorized');

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const SettleBillSchema = z.object({
      studentId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      settlementType: z.enum(['discount', 'voluntary_contribution', 'unapplied_cash']),
      amount: z.number().int().positive(),
      reason: z.string().max(500),
      consentGiven: z.boolean().optional(),
      approverName: z.string().optional(),
    });

    const body = await req.json();
    const {
      studentId,
      month,
      settlementType,
      amount,
      reason,
      consentGiven,
      approverName
    } = SettleBillSchema.parse(body);

    console.log('Settling bill:', { studentId, month, settlementType, amount });

    // Validate consent for voluntary contribution
    if (settlementType === 'voluntary_contribution' && !consentGiven) {
      throw new Error('Consent required for voluntary contribution');
    }

    // Get current invoice balance
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('student_id', studentId)
      .eq('month', month)
      .single();

    if (!invoice) {
      throw new Error('No invoice found for this month');
    }

    const balance = invoice.total_amount - invoice.paid_amount;

    // Get student accounts
    const { data: accounts } = await supabase
      .from('ledger_accounts')
      .select('id, code')
      .eq('student_id', studentId);

    const accountMap = new Map(accounts?.map(a => [a.code, a.id]));
    const txId = crypto.randomUUID();

    if (settlementType === 'discount') {
      // Handle debit balance: DR Tuition Discounts expense / CR AR
      if (balance <= 0) {
        throw new Error('No debit balance to discount');
      }

      const discountAmount = Math.min(amount, balance);

      await supabase.from('ledger_entries').insert([
        {
          tx_id: txId,
          tx_key: `settlement-discount-${studentId}-${month}-${Date.now()}`,
          account_id: accountMap.get('DISCOUNT'),
          debit: discountAmount,
          credit: 0,
          occurred_at: new Date().toISOString(),
          memo: `Settlement discount: ${reason}`,
          month,
          created_by: user.id
        },
        {
          tx_id: txId,
          account_id: accountMap.get('AR'),
          debit: 0,
          credit: discountAmount,
          occurred_at: new Date().toISOString(),
          memo: `Settlement discount: ${reason}`,
          month,
          created_by: user.id
        }
      ]);

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          paid_amount: invoice.paid_amount + discountAmount,
          status: invoice.total_amount <= invoice.paid_amount + discountAmount ? 'paid' : 'partial'
        })
        .eq('id', invoice.id);

    } else if (settlementType === 'voluntary_contribution') {
      // Handle credit balance: DR AR / CR Contributions revenue
      if (balance >= 0) {
        throw new Error('No credit balance to convert');
      }

      const creditAmount = Math.abs(balance);
      const contributionAmount = Math.min(amount, creditAmount);

      await supabase.from('ledger_entries').insert([
        {
          tx_id: txId,
          tx_key: `settlement-contribution-${studentId}-${month}-${Date.now()}`,
          account_id: accountMap.get('AR'),
          debit: contributionAmount,
          credit: 0,
          occurred_at: new Date().toISOString(),
          memo: `Voluntary contribution (consent: ${approverName || 'yes'}): ${reason}`,
          month,
          created_by: user.id
        },
        {
          tx_id: txId,
          account_id: accountMap.get('REVENUE'),
          debit: 0,
          credit: contributionAmount,
          occurred_at: new Date().toISOString(),
          memo: `Voluntary contribution: ${reason}`,
          month,
          created_by: user.id
        }
      ]);

    } else if (settlementType === 'unapplied_cash') {
      // Handle credit balance: keep as customer credit liability
      if (balance >= 0) {
        throw new Error('No credit balance to record as unapplied');
      }

      const creditAmount = Math.abs(balance);
      const unappliedAmount = Math.min(amount, creditAmount);

      await supabase.from('ledger_entries').insert([
        {
          tx_id: txId,
          tx_key: `settlement-unapplied-${studentId}-${month}-${Date.now()}`,
          account_id: accountMap.get('AR'),
          debit: unappliedAmount,
          credit: 0,
          occurred_at: new Date().toISOString(),
          memo: `Unapplied cash liability: ${reason}`,
          month,
          created_by: user.id
        },
        {
          tx_id: txId,
          account_id: accountMap.get('CREDIT'),
          debit: 0,
          credit: unappliedAmount,
          occurred_at: new Date().toISOString(),
          memo: `Customer credit for future use: ${reason}`,
          month,
          created_by: user.id
        }
      ]);
    }

    // Record settlement
    await supabase.from('settlements').insert({
      student_id: studentId,
      month,
      settlement_type: settlementType,
      amount,
      reason,
      consent_given: consentGiven || false,
      approver_id: user.id,
      created_by: user.id,
      tx_id: txId,
      before_balance: balance,
      after_balance: settlementType === 'discount' ? balance - amount : balance
    });

    // Trigger tuition recalc
    try {
      await supabase.functions.invoke('calculate-tuition', {
        body: { studentId, month }
      });
    } catch (e) {
      console.error('Failed to recalc tuition:', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        txId,
        settlementType,
        amount,
        beforeBalance: balance,
        afterBalance: settlementType === 'discount' ? balance - amount : balance
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error settling bill:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
