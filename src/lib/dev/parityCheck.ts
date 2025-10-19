import { supabase } from "@/integrations/supabase/client";

/**
 * Development-only parity checker
 * Compares Admin Finance data with Student Profile data
 * to ensure they show identical values for the same student/month
 */
export async function checkStudentFinanceParity(
  studentId: string, 
  month: string,
  studentData: {
    cumulativePaidAmount: number;
    totalAmount: number;
    baseAmount: number;
    totalDiscount: number;
    balance: number;
  }
) {
  // Only run in development
  if (import.meta.env.PROD) return;

  try {
    // Fetch Admin data source (invoices table)
    const { data: adminData, error } = await supabase
      .from('invoices')
      .select('base_amount, discount_amount, total_amount, paid_amount')
      .eq('student_id', studentId)
      .eq('month', month)
      .maybeSingle();

    if (error || !adminData) {
      console.warn('⚠️ Parity check skipped - no invoice found:', { studentId, month });
      return;
    }

    // Compare and log differences
    const diffs: string[] = [];
    
    if (Math.abs(adminData.paid_amount - studentData.cumulativePaidAmount) > 0.01) {
      diffs.push(`Paid: Admin=${adminData.paid_amount}, Student=${studentData.cumulativePaidAmount}`);
    }
    
    if (Math.abs(adminData.total_amount - studentData.totalAmount) > 0.01) {
      diffs.push(`Total: Admin=${adminData.total_amount}, Student=${studentData.totalAmount}`);
    }
    
    if (Math.abs(adminData.base_amount - studentData.baseAmount) > 0.01) {
      diffs.push(`Base: Admin=${adminData.base_amount}, Student=${studentData.baseAmount}`);
    }
    
    if (Math.abs(adminData.discount_amount - studentData.totalDiscount) > 0.01) {
      diffs.push(`Discount: Admin=${adminData.discount_amount}, Student=${studentData.totalDiscount}`);
    }

    const adminBalance = adminData.total_amount - adminData.paid_amount;
    if (Math.abs(adminBalance - studentData.balance) > 0.01) {
      diffs.push(`Balance: Admin=${adminBalance}, Student=${studentData.balance}`);
    }

    if (diffs.length > 0) {
      console.error('🚨 PARITY CHECK FAILED:', { 
        studentId, 
        month, 
        diffs,
        adminData,
        studentData 
      });
    } else {
      console.log('✅ Parity check passed:', { studentId, month });
    }
  } catch (error) {
    console.error('Parity check error:', error);
  }
}
