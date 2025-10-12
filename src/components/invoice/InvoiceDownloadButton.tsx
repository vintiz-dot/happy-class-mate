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
      // Fetch invoice projection
      const { data: tuitionData, error: tuitionError } = await supabase.functions.invoke(
        'calculate-tuition',
        { body: { student_id: studentId, month } }
      );

      if (tuitionError) throw tuitionError;

      // Fetch bank info
      const { data: bankData, error: bankError } = await supabase
        .from('bank_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (bankError) throw bankError;

      if (!bankData) {
        throw new Error('Bank information not configured');
      }

      // Map to invoice format
      const invoice = mapUpstreamToInvoice({
        ...tuitionData,
        student_id: studentId,
        month: month,
      });

      setInvoiceData(invoice);
      setBankInfo(bankData);
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
          {invoiceData && bankInfo && (
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
