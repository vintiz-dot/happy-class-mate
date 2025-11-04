import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchInvoiceData } from "@/lib/invoice/fetchInvoiceData";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceData, BankInfo } from "@/lib/invoice/types";

type Pair = { invoice: InvoiceData; bankInfo: BankInfo };

export function TuitionBulkDownload({ month }: { month: string }) {
  const [downloadType, setDownloadType] = useState<"all" | "class" | "family">("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [invoices, setInvoices] = useState<Array<Pair>>([]);

  const { data: classes } = useQuery({
    queryKey: ["classes-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: families } = useQuery({
    queryKey: ["families-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleLoadInvoices = async () => {
    setLoading(true);
    try {
      let studentIds: string[] = [];

      if (downloadType === "all") {
        const { data, error } = await supabase.from("students").select("id").eq("is_active", true);
        if (error) throw error;
        studentIds = data.map((s) => s.id);
      } else if (downloadType === "class" && selectedClassId) {
        const { data, error } = await supabase
          .from("enrollments")
          .select("student_id")
          .eq("class_id", selectedClassId)
          .is("end_date", null);
        if (error) throw error;
        studentIds = data.map((e) => e.student_id);
      } else if (downloadType === "family" && selectedFamilyId) {
        const { data, error } = await supabase
          .from("students")
          .select("id")
          .eq("family_id", selectedFamilyId)
          .eq("is_active", true);
        if (error) throw error;
        studentIds = data.map((s) => s.id);
      }

      if (studentIds.length === 0) {
        toast.error("No students found for the selected criteria");
        return;
      }

      const results = await Promise.allSettled(studentIds.map((sid) => fetchInvoiceData(sid, month)));
      const ok = results
        .filter(
          (r): r is PromiseFulfilledResult<{ invoice: InvoiceData; bankInfo: BankInfo }> => r.status === "fulfilled",
        )
        .map((r) => r.value);
      const failed = results.length - ok.length;

      if (ok.length === 0) {
        toast.error("All invoice generations failed");
        return;
      }

      setInvoices(ok);
      setShowPreview(true);
      toast.success(`${ok.length} invoices loaded${failed ? `. ${failed} failed.` : ""}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error loading invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = () => {
    toast.info("Use your browser's Print dialog (Ctrl/Cmd + P) and select 'Save as PDF' to download all invoices");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bulk Invoice Download</CardTitle>
          <CardDescription>Download multiple tuition invoices as PDFs in a ZIP file</CardDescription>
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
            onClick={handleLoadInvoices}
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
                Loading Invoices…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Load Invoices
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          <div className="flex justify-end gap-2 mb-4">
            <Button onClick={handleDownloadZip}>
              <Download className="h-4 w-4 mr-2" />
              Print / Save as PDF
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </div>

          <div className="space-y-8">
            {invoices.map((item, index) => (
              <div key={index} className="page-break">
                <InvoicePrintView invoice={item.invoice} bankInfo={item.bankInfo} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
