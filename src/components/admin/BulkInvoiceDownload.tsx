// src/components/invoice/BulkInvoiceDownload.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchInvoiceData } from "@/lib/invoice/fetchInvoiceData";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceData, BankInfo } from "@/lib/invoice/types";

/* === Zero-install dynamic imports (same as individual button) === */
let _deps: null | {
  jsPDF: any;
  html2canvas: any;
  JSZip: any;
  saveAs: (blob: Blob, name?: string) => void;
} = null;

async function loadPdfDeps() {
  if (_deps) return _deps;
  const jsPDF = (await import("https://esm.sh/jspdf@2.5.1")).default;
  const html2canvas = (await import("https://esm.sh/html2canvas@1.4.1")).default;
  const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
  const { saveAs } = await import("https://esm.sh/file-saver@2.0.5");
  _deps = { jsPDF, html2canvas, JSZip, saveAs };
  return _deps;
}

/* === DOM -> paginated PDF (A4). Identical logic to individual download === */
async function elementToPdfBlob(
  el: HTMLElement,
  opts?: { marginMm?: number; pageSize?: "a4" | "letter" },
): Promise<Blob> {
  const { jsPDF, html2canvas } = await loadPdfDeps();
  const marginMm = opts?.marginMm ?? 10;
  const page = (opts?.pageSize ?? "a4") === "a4" ? { wMm: 210, hMm: 297 } : { wMm: 216, hMm: 279 };

  try {
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {}

  const rect = el.getBoundingClientRect();
  const scale = Math.min(2, (window.devicePixelRatio || 1) * 2);

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: Math.ceil(rect.width),
    windowHeight: Math.ceil(rect.height),
  });

  const pdf = new jsPDF({ unit: "mm", format: [page.wMm, page.hMm], orientation: "portrait", compress: true });
  const pdfW = page.wMm - marginMm * 2;
  const pdfH = page.hMm - marginMm * 2;

  const imgWpx = canvas.width;
  const imgHpx = canvas.height;
  const pxPerMm = imgWpx / pdfW;
  const pagePxHeight = Math.floor(pdfH * pxPerMm);

  let currentY = 0;
  const pageCanvas = document.createElement("canvas");
  const ctx = pageCanvas.getContext("2d")!;
  pageCanvas.width = imgWpx;
  pageCanvas.height = pagePxHeight;

  while (currentY < imgHpx) {
    const sliceHeight = Math.min(pagePxHeight, imgHpx - currentY);
    if (pageCanvas.height !== sliceHeight) pageCanvas.height = sliceHeight;

    ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, currentY, imgWpx, sliceHeight, 0, 0, imgWpx, sliceHeight);

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (currentY > 0) pdf.addPage([page.wMm, page.hMm], "portrait");
    pdf.addImage(imgData, "JPEG", marginMm, marginMm, pdfW, sliceHeight / pxPerMm);

    currentY += sliceHeight;
  }

  return pdf.output("blob");
}

/* === Naming helpers (shared idea) === */
type Pair = { invoice: InvoiceData; bankInfo: BankInfo };
function safeName(s: string) {
  return s.replace(/[^\w\-]+/g, "_").slice(0, 80);
}
function deriveFileName(p: Pair, month: string, index: number) {
  const inv: any = p.invoice;
  const candidate =
    inv?.invoiceNumber ?? inv?.student?.code ?? inv?.student?.name ?? inv?.student_name ?? `student_${index + 1}`;
  return `INV_${month}_${safeName(String(candidate))}.pdf`;
}

/* === Build ZIP from currently rendered invoice nodes === */
async function downloadInvoicesZipFromDom(pairs: Pair[], month: string, selector = ".page-break") {
  const { JSZip, saveAs } = await loadPdfDeps();
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (!nodes.length) throw new Error("No invoice nodes found in DOM.");
  const count = Math.min(nodes.length, pairs.length);

  const zip = new JSZip();

  for (let i = 0; i < count; i++) {
    const node = nodes[i];
    const blob = await elementToPdfBlob(node);
    const name = deriveFileName(pairs[i], month, i);
    zip.file(name, blob);
    // Yield to UI for very large batches
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 0));
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  saveAs(zipBlob, `invoices_${month}.zip`);
}

export function BulkInvoiceDownload({ month }: { month: string }) {
  const { toast } = useToast();
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
        toast({
          title: "No students found",
          description: "No students match the selected criteria.",
          variant: "destructive",
        });
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
        toast({
          title: "No invoices generated",
          description: "All invoice generations failed.",
          variant: "destructive",
        });
        return;
      }

      setInvoices(ok);
      setShowPreview(true);
      toast({ title: "Invoices loaded", description: `${ok.length} ready${failed ? `. ${failed} failed.` : ""}` });
    } catch (e: any) {
      toast({ title: "Error loading invoices", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      await downloadInvoicesZipFromDom(invoices, month);
    } catch (e: any) {
      const msg =
        e?.message?.includes("Failed to fetch dynamically imported module") || e?.message?.includes("module script")
          ? "CDN modules blocked by host."
          : (e?.message ?? "Unknown error");
      toast({ title: "Download failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bulk Invoice Download</CardTitle>
          <CardDescription>Load and print multiple invoices at once</CardDescription>
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
          <div className="flex justify-end gap-2 mb-4 no-print">
            <Button onClick={handlePrint}>Print All / Save as PDF</Button>
            <Button variant="secondary" onClick={handleDownloadZip} disabled={invoices.length === 0 || downloading}>
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing ZIP…
                </>
              ) : (
                "Download ZIP (PDFs)"
              )}
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

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
          .page-break:last-child { page-break-after: auto; }
        }
      `}</style>
    </>
  );
}
