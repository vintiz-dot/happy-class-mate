import { supabase } from "@/integrations/supabase/client";

export interface PaymentData {
  studentId: string;
  amount: number;
  method: string;
  occurredAt: string;
  payerName?: string;
  memo?: string;
}

/**
 * Unified payment posting function used across all admin payment UIs
 */
export async function postStudentPayment(paymentData: PaymentData) {
  const { data, error } = await supabase.functions.invoke("record-payment", {
    body: {
      studentId: paymentData.studentId,
      amount: Math.round(paymentData.amount),
      method: paymentData.method,
      occurredAt: paymentData.occurredAt,
      payerName: paymentData.payerName,
      memo: paymentData.memo,
    },
  });

  if (error) throw error;
  
  // Extract month from occurredAt for query invalidation
  const month = paymentData.occurredAt.slice(0, 7); // YYYY-MM
  
  return { data, month };
}
