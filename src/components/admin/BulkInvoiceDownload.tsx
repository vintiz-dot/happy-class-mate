import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapUpstreamToInvoice } from "@/lib/invoice/adapter";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function BulkInvoiceDownload({ month }: { month: string }) {
  const { toast } = useToast();
  const [downloadType, setDownloadType] = useState<"all" | "class" | "family">("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: families } = useQuery({
    queryKey: ['families-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleBulkDownload = async () => {
    setLoading(true);
    try {
      let studentIds: string[] = [];

      // Get student IDs based on download type
      if (downloadType === "all") {
        const { data, error } = await supabase
          .from('students')
          .select('id')
          .eq('is_active', true);
        if (error) throw error;
        studentIds = data.map(s => s.id);
      } else if (downloadType === "class" && selectedClassId) {
        const { data, error } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', selectedClassId)
          .is('end_date', null);
        if (error) throw error;
        studentIds = data.map(e => e.student_id);
      } else if (downloadType === "family" && selectedFamilyId) {
        const { data, error } = await supabase
          .from('students')
          .select('id')
          .eq('family_id', selectedFamilyId)
          .eq('is_active', true);
        if (error) throw error;
        studentIds = data.map(s => s.id);
      }

      if (studentIds.length === 0) {
        toast({
          title: "No students found",
          description: "No students match the selected criteria.",
          variant: "destructive",
        });
        return;
      }

      // Fetch bank info
      const { data: bankData, error: bankError } = await supabase
        .from('bank_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (bankError) throw bankError;
      if (!bankData) {
        throw new Error('Bank information not configured. Please configure in Account Info.');
      }

      // Download invoices one by one (open print dialog for each)
      for (const studentId of studentIds) {
        // Fetch student info
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, family:families(name)')
          .eq('id', studentId)
          .single();

        if (studentError) continue;

        // Fetch tuition data
        const { data: tuitionData, error: tuitionError } = await supabase.functions.invoke(
          'calculate-tuition',
          { body: { studentId: studentId, month } }
        );

        if (tuitionError) continue;

        // Group sessions by class
        const classBreakdown: Record<string, { sessions: any[], total: number }> = {};
        
        for (const session of tuitionData.sessionDetails || []) {
          const className = 'Class';
          if (!classBreakdown[className]) {
            classBreakdown[className] = { sessions: [], total: 0 };
          }
          classBreakdown[className].sessions.push(session);
          classBreakdown[className].total += session.rate || 0;
        }

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

        // Create a temporary container for printing
        const printContainer = document.createElement('div');
        printContainer.style.display = 'none';
        document.body.appendChild(printContainer);
        
        // Render invoice
        const root = document.createElement('div');
        printContainer.appendChild(root);
        
        // Note: This is a simplified approach. In production, you'd want to use
        // a proper React rendering solution or a backend PDF generation service
        const invoiceHTML = `
          <html>
            <head>
              <title>Invoice - ${studentData.full_name}</title>
            </head>
            <body>
              <div>Invoice for ${studentData.full_name} - ${month}</div>
            </body>
          </html>
        `;
        
        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(invoiceHTML);
          printWindow.document.close();
          printWindow.print();
        }
        
        document.body.removeChild(printContainer);
        
        // Add delay between prints
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "Bulk download initiated",
        description: `Opening ${studentIds.length} invoice(s) for printing.`,
      });
    } catch (error: any) {
      toast({
        title: "Error generating invoices",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Invoice Download</CardTitle>
        <CardDescription>
          Download invoices for multiple students at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Download Type</label>
          <Select value={downloadType} onValueChange={(v: any) => setDownloadType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="class">By Class</SelectItem>
              <SelectItem value="family">By Family</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {downloadType === "class" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Class</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                {classes?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {downloadType === "family" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Family</label>
            <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a family" />
              </SelectTrigger>
              <SelectContent>
                {families?.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={handleBulkDownload}
          disabled={
            loading ||
            (downloadType === "class" && !selectedClassId) ||
            (downloadType === "family" && !selectedFamilyId)
          }
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Invoices...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download Invoices
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
