import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapUpstreamToInvoice } from "@/lib/invoice/adapter";
import { InvoicePrintView } from "./InvoicePrintView";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { InvoiceData, BankInfo } from "@/lib/invoice/types";

interface InvoiceDownloadButtonProps {
  studentId: string;
  month: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function InvoiceDownloadButton({ 
  studentId, 
  month, 
  variant = "outline",
  size = "default" 
}: InvoiceDownloadButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      // Fetch student and family info
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, family:families(name)')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      // Fetch invoice projection
      const { data: tuitionData, error: tuitionError } = await supabase.functions.invoke(
        'calculate-tuition',
        { body: { studentId: studentId, month } }
      );

      if (tuitionError) throw tuitionError;

      // Fetch bank info
      const { data: bankData, error: bankError } = await supabase
        .from('bank_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (bankError) {
        throw new Error(`Failed to fetch bank information: ${bankError.message}`);
      }

      if (!bankData) {
        throw new Error('Bank information not configured. Please contact administration to set up account information before downloading invoices.');
      }

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

      setInvoiceData(invoice);
      setBankInfo(bankData || null);
      
      toast({
        title: "Invoice Loaded",
        description: "Ready to print or save as PDF",
      });
      setShowPreview(true);
    } catch (error: any) {
      toast({
        title: "Error loading invoice",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={fetchInvoiceData}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span className="ml-2">Download Invoice</span>
      </Button>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          {invoiceData && (
            <>
              <div className="flex justify-end gap-2 mb-4 no-print">
                <Button onClick={handlePrint}>
                  Print / Save as PDF
                </Button>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </div>
              <InvoicePrintView invoice={invoiceData} bankInfo={bankInfo} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
