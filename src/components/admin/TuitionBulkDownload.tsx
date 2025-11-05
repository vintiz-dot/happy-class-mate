"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchInvoiceData } from "@/lib/invoice/fetchInvoiceData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceData, BankInfo } from "@/lib/invoice/types";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Safari/iOS fallback
  // @ts-ignore
  if (!("download" in HTMLAnchorElement.prototype)) {
    window.open(url, "_blank");
  }

  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}

type Pair = { invoice: InvoiceData; bankInfo: BankInfo };

export function TuitionBulkDownload({ month }: { month: string }) {
  const [downloadType, setDownloadType] = useState<"all" | "class" | "family">("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
      toast.success(`${ok.length} invoices loaded${failed ? `. ${failed} failed.` : ""}. Ready to download.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error loading invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (invoices.length === 0) {
      toast.error("No invoices to download");
      return;
    }

    setDownloading(true);
    const zip = new JSZip();
    const folder = zip.folder(`invoices-${month}`);

    try {
      toast.info(`Generating ${invoices.length} PDFs...`);

      for (let i = 0; i < invoices.length; i++) {
        const item = invoices[i];
        const studentName = item.invoice.student.full_name
          .normalize("NFD")
          .replace(/[\\u0300-\\u036f]/g, "")
          .replace(/[^a-z0-9]/gi, "_");
        const fileName = `${studentName}_${month}.pdf`;

        const totalDiscount = item.invoice.discounts.reduce((sum, d) => sum + d.amount_vnd, 0);

        // Create a temporary div to render the invoice
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-9999px";
        tempDiv.innerHTML = `
          <div style="width: 210mm; padding: 20mm; background: white; font-family: system-ui, -apple-system, sans-serif;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">TUITION INVOICE</h1>
              <p style="color: #666;">Invoice #${item.invoice.invoice_number}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <p><strong>Student:</strong> ${item.invoice.student.full_name}</p>
              <p><strong>Billing Period:</strong> ${item.invoice.billing_period}</p>
              <p><strong>Date:</strong> ${item.invoice.issue_date}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Class</th>
                  <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Sessions</th>
                  <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Rate</th>
                  <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${item.invoice.classes
                  .map((cls) => {
                    const ratePerSession = cls.sessions_count > 0 ? cls.amount_vnd / cls.sessions_count : 0;
                    return `
                  <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb;">${cls.class_name}</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">${cls.sessions_count}</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">${new Intl.NumberFormat("vi-VN").format(ratePerSession)} VND</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">${new Intl.NumberFormat("vi-VN").format(cls.amount_vnd)} VND</td>
                  </tr>
                `;
                  })
                  .join("")}
              </tbody>
            </table>

            <div style="text-align: right; margin-bottom: 20px;">
              <p><strong>Subtotal:</strong> ${new Intl.NumberFormat("vi-VN").format(item.invoice.subtotal_vnd)} VND</p>
              ${
                item.invoice.discounts.length > 0
                  ? `
                <p style="color: #16a34a;"><strong>Discounts:</strong> -${new Intl.NumberFormat("vi-VN").format(totalDiscount)} VND</p>
              `
                  : ""
              }
              <p style="font-size: 18px; margin-top: 10px;"><strong>Total Due:</strong> ${new Intl.NumberFormat("vi-VN").format(item.invoice.total_due_vnd)} VND</p>
            </div>

            ${
              item.bankInfo
                ? `
              <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb;">
                <h3 style="margin-bottom: 10px;">Payment Instructions</h3>
                <p><strong>Bank:</strong> ${item.bankInfo.bank_name}</p>
                <p><strong>Account Number:</strong> ${item.bankInfo.account_number}</p>
                <p><strong>Account Holder:</strong> ${item.bankInfo.account_name}</p>
              </div>
            `
                : ""
            }
          </div>
        `;
        document.body.appendChild(tempDiv);

        // Generate PDF
        const pdfBlob = await html2pdf()
          .from(tempDiv)
          .set({
            margin: 0,
            filename: fileName,
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .outputPdf("blob");

        document.body.removeChild(tempDiv);
        folder?.file(fileName, pdfBlob);

        if ((i + 1) % 5 === 0 || i === invoices.length - 1) {
          toast.info(`Generated ${i + 1}/${invoices.length} PDFs...`);
        }
      }

      // Generate and download the ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `invoices-${month}.zip`);
      toast.success(`Successfully downloaded ${invoices.length} invoices!`);
    } catch (error: any) {
      console.error("Error generating ZIP:", error);
      toast.error(error?.message ?? "Failed to generate ZIP file");
    } finally {
      setDownloading(false);
    }
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

          <div className="flex gap-2">
            <Button
              onClick={handleLoadInvoices}
              disabled={
                loading ||
                (downloadType === "class" && !selectedClassId) ||
                (downloadType === "family" && !selectedFamilyId)
              }
              className="flex-1"
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

            {invoices.length > 0 && (
              <Button onClick={handleDownloadZip} disabled={downloading} variant="default">
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating ZIP…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download ZIP ({invoices.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
