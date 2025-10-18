import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_lib/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Payment validation constants
const MIN_PAYMENT_VND = 10000; // 10K VND
const MAX_PAYMENT_VND = 50000000; // 50M VND
const MAX_OVERPAYMENT_VND = 5000000; // 5M VND overpayment allowed

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey 
    })
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user ID for rate limiting
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    const userId = user?.id || 'anonymous';
    const clientIP = getClientIP(req);

    // Rate limiting: 10 payments per minute per user
    const userRateCheck = checkRateLimit(userId, 10, 60 * 1000, 'user');
    if (userRateCheck.limited) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      await supabase.from('audit_log').insert({
        action: 'rate_limit_exceeded',
        entity: 'payment',
        actor_user_id: userId,
        diff: { reason: 'payment_rate_limit', ip: clientIP }
      });
      return rateLimitResponse(userRateCheck.resetAt, corsHeaders);
    }

    // IP-based rate limiting: 20 payments per minute per IP
    const ipRateCheck = checkRateLimit(clientIP, 20, 60 * 1000, 'ip');
    if (ipRateCheck.limited) {
      console.warn(`Rate limit exceeded for IP ${clientIP}`);
      return rateLimitResponse(ipRateCheck.resetAt, corsHeaders);
    }

    // Validate input with Zod schema
    const PaymentSchema = z.object({
      studentId: z.string().uuid('Invalid student ID format'),
      amount: z.number().int().positive().max(100000000, 'Amount exceeds maximum'),
      method: z.enum(['cash', 'bank', 'Cash', 'Bank Transfer', 'Card', 'Other'], {
        errorMap: () => ({ message: 'Invalid payment method' })
      }),
      occurredAt: z.string().datetime().optional(),
      memo: z.string().max(500, 'Memo too long').optional()
    });

    const body = await req.json()
    const { studentId, amount, method, memo, occurredAt } = PaymentSchema.parse(body)
    console.log('Posting payment:', { studentId, amount, method, memo, occurredAt })

    // Business logic validation for payment amounts
    if (amount < MIN_PAYMENT_VND) {
      throw new Error(`Payment amount too small. Minimum payment is ${MIN_PAYMENT_VND.toLocaleString()} VND`);
    }
    
    if (amount > MAX_PAYMENT_VND) {
      throw new Error(`Payment amount exceeds reasonable limit. Maximum payment is ${MAX_PAYMENT_VND.toLocaleString()} VND`);
    }

    // Check outstanding balance to prevent excessive overpayments
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount')
      .eq('student_id', studentId)
      .neq('status', 'paid');

    if (!invoiceError && invoices) {
      const totalOutstanding = invoices.reduce((sum, inv) => 
        sum + (inv.total_amount - inv.paid_amount), 0
      );
      
      if (amount > totalOutstanding + MAX_OVERPAYMENT_VND) {
        console.warn(`Large overpayment detected: ${amount} VND payment for ${totalOutstanding} VND outstanding balance`);
        // Log but allow - may be prepayment for future tuition
        await supabase.from('audit_log').insert({
          action: 'large_overpayment',
          entity: 'payment',
          actor_user_id: userId,
          diff: { 
            studentId, 
            amount, 
            outstanding: totalOutstanding,
            overpayment: amount - totalOutstanding 
          }
        });
      }
    }

    const txId = crypto.randomUUID()
    const actorUserId = req.headers.get('x-user-id')

    // Ensure ledger accounts exist for student
    console.log('Creating/checking ledger accounts for student:', studentId)
    const accountCodes = ['AR', 'REVENUE', 'DISCOUNT', 'CASH', 'BANK', 'CREDIT']
    for (const code of accountCodes) {
      const { error: upsertError } = await supabase
        .from('ledger_accounts')
        .upsert(
          { student_id: studentId, code },
          { onConflict: 'student_id,code', ignoreDuplicates: true }
        )
      
      if (upsertError) {
        console.error(`Error upserting ${code} account:`, upsertError)
        throw new Error(`Failed to create ${code} account: ${upsertError.message}`)
      }
    }

    // Get account IDs
    console.log('Fetching account IDs')
    const { data: accounts, error: accountsError } = await supabase
      .from('ledger_accounts')
      .select('id, code')
      .eq('student_id', studentId)

    if (accountsError) throw new Error(`Failed to fetch accounts: ${accountsError.message}`)
    if (!accounts || accounts.length === 0) throw new Error('No accounts found for student')

    const accountMap = new Map(accounts?.map(a => [a.code, a.id]))
    console.log('Account map created with', accountMap.size, 'accounts')

    // Record payment
    console.log('Recording payment in payments table')
    const { error: paymentError } = await supabase.from('payments').insert({
      student_id: studentId,
      amount,
      method,
      memo,
      occurred_at: occurredAt || new Date().toISOString(),
      created_by: actorUserId
    })

    if (paymentError) throw new Error(`Failed to record payment: ${paymentError.message}`)

    const month = (occurredAt || new Date().toISOString()).slice(0, 7)
    const accountId = method === 'cash' ? accountMap.get('CASH') : accountMap.get('BANK')

    // Post to ledger: Dr CASH/BANK, Cr AR
    console.log('Creating ledger entries')
    const { error: ledgerError } = await supabase.from('ledger_entries').insert([
      {
        tx_id: txId,
        account_id: accountId,
        debit: amount,
        credit: 0,
        occurred_at: occurredAt || new Date().toISOString(),
        memo: memo || `Payment received via ${method}`,
        month,
        created_by: actorUserId
      },
      {
        tx_id: txId,
        account_id: accountMap.get('AR'),
        debit: 0,
        credit: amount,
        occurred_at: occurredAt || new Date().toISOString(),
        memo: memo || `Payment applied`,
        month,
        created_by: actorUserId
      }
    ])

    if (ledgerError) throw new Error(`Failed to create ledger entries: ${ledgerError.message}`)

    // Apply FIFO to open invoices
    let remainingAmount = amount
    const { data: openInvoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('student_id', studentId)
      .neq('status', 'paid')
      .order('month', { ascending: true })

    for (const invoice of openInvoices || []) {
      if (remainingAmount <= 0) break

      const owed = invoice.total_amount - invoice.paid_amount
      const applied = Math.min(remainingAmount, owed)
      const newPaid = invoice.paid_amount + applied

      let newStatus = invoice.status
      if (newPaid >= invoice.total_amount) {
        newStatus = 'paid'
      } else if (newPaid > 0) {
        newStatus = 'partial'
      }

      await supabase
        .from('invoices')
        .update({ paid_amount: newPaid, status: newStatus })
        .eq('id', invoice.id)

      remainingAmount -= applied
      console.log(`Applied ${applied} to invoice ${invoice.id}, remaining: ${remainingAmount}`)
    }

    // If overpayment, post to CREDIT account
    if (remainingAmount > 0) {
      console.log('Overpayment detected:', remainingAmount)
      const creditTxId = crypto.randomUUID()
      
      await supabase.from('ledger_entries').insert([
        {
          tx_id: creditTxId,
          account_id: accountMap.get('AR'),
          debit: remainingAmount,
          credit: 0,
          occurred_at: occurredAt || new Date().toISOString(),
          memo: 'Overpayment - credit balance',
          month,
          created_by: actorUserId
        },
        {
          tx_id: creditTxId,
          account_id: accountMap.get('CREDIT'),
          debit: 0,
          credit: remainingAmount,
          occurred_at: occurredAt || new Date().toISOString(),
          memo: 'Credit balance for future use',
          month,
          created_by: actorUserId
        }
      ])
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        txId,
        appliedAmount: amount - remainingAmount,
        creditBalance: remainingAmount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
