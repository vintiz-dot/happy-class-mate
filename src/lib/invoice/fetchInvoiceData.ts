import { supabase } from "@/integrations/supabase/client";
import { mapUpstreamToInvoice } from "./adapter";
import type { InvoiceData, BankInfo } from "./types";

export interface FetchInvoiceResult {
  invoice: InvoiceData;
  bankInfo: BankInfo;
}

/**
 * Shared utility to fetch invoice data for a student and month
 * Used by both single and bulk invoice downloads
 */
export async function fetchInvoiceData(
  studentId: string,
  month: string
): Promise<FetchInvoiceResult> {
  // Fetch student and family info
  const { data: studentData, error: studentError } = await supabase
    .from('students')
    .select('id, full_name, family:families(name)')
    .eq('id', studentId)
    .single();

  if (studentError) throw new Error(`Failed to fetch student: ${studentError.message}`);
  if (!studentData) throw new Error('Student not found');

  // Fetch invoice projection
  const { data: tuitionData, error: tuitionError } = await supabase.functions.invoke(
    'calculate-tuition',
    { body: { studentId, month } }
  );

  if (tuitionError) throw new Error(`Failed to calculate tuition: ${tuitionError.message}`);
  if (!tuitionData) throw new Error('No tuition data returned');

  // Fetch bank info
  const { data: bankData, error: bankError } = await supabase
    .from('bank_info')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (bankError) throw new Error(`Failed to fetch bank info: ${bankError.message}`);
  if (!bankData) throw new Error('Payment information not configured. Please contact administration.');

  // Group sessions by class
  const classBreakdown: Record<string, { sessions: any[], total: number }> = {};
  
  for (const session of tuitionData.sessionDetails || []) {
    const className = 'Class'; // Since sessionDetails don't include class name
    if (!classBreakdown[className]) {
      classBreakdown[className] = { sessions: [], total: 0 };
    }
    classBreakdown[className].sessions.push(session);
    classBreakdown[className].total += session.rate || 0;
  }

  // Map to invoice format
  const invoice = mapUpstreamToInvoice({
    ...tuitionData,
    student_id: studentData.id,
    student_name: studentData.full_name,
    family_name: studentData.family?.name,
    class_breakdown: Object.entries(classBreakdown).map(([name, data]) => ({
      class_name: name,
      sessions_count: data.sessions.length,
      amount_vnd: data.total,
    })),
  });

  return { invoice, bankInfo: bankData };
}
