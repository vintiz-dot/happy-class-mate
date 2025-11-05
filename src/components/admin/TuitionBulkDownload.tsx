"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { createRoot } from "react-dom/client";

import type { InvoiceData, BankInfo } from "@/lib/invoice/types";
import { fetchInvoiceData } from "@/lib/invoice/fetchInvoiceData";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";

type Pair = { invoice: InvoiceData; bankInfo: BankInfo | null };

type DownloadScope = "active" | "custom";

export function TuitionBulkDownload({ month }: { month: string }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadType, setDownloadType] = useState<DownloadScope>("active");
  const [customIdsText, setCustomIdsText] = useState<string>("");

  // Fetch active student IDs by default
  const { data: activeIds = [], isLoading } = useQuery({
    queryKey: ["active-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id").eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.id as string);
    },
  });

  const customIds = useMemo(() => {
    return customIdsText
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [customIdsText]);

  const targetIds = downloadType === "active" ? activeIds : customIds;

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

  function sanitizeFilename(name: string) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "_");
  }

  function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    return Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            const el = img as HTMLImageElement;
            if (el.complete) return resolve();
            el.crossOrigin = "anonymous";
            el.onload = () => resolve();
            el.onerror = () => resolve();
          }),
      ),
    );
  }

  function nextFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function renderInvoiceToBlob(pair: Pair): Promise<Blob> {
    // Create container off-screen but rendered
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px"; // ~A4 at 96dpi
    container.style.background = "#ffffff";
    container.className = "print-container";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<InvoicePrintView invoice={pair.invoice} bankInfo={pair.bankInfo} />);

    // Allow layout and image loads
    await nextFrame();
    await nextFrame();
    await waitForImages(container);

    const opts = {
      margin: [10, 10, 10, 10],
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: container.scrollWidth },
      filename: "tmp.pdf",
    };

    try {
      const blob: Blob = await (html2pdf() as any)
        .from(container)
        .set(opts)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => pdf.output("blob"));

      return blob;
    } finally {
      // Cleanup
      try {
        root.unmount();
      } catch {}
      document.body.removeChild(container);
    }
  }

  async function handleDownloadZip() {
    if (!month) {
      toast.error("Month is required");
      return;
    }
    if (targetIds.length === 0) {
      toast.error("No students to process");
      return;
    }

    setDownloading(true);
    const zip = new JSZip();

    let success = 0;
    let skipped = 0;

    toast.info(`Generating ${targetIds.length} invoices...`);

    for (let i = 0; i < targetIds.length; i++) {
      const studentId = targetIds[i];
      try {
        const { invoice, bankInfo } = await fetchInvoiceData(studentId, month);
        const pair: Pair = { invoice, bankInfo };
        const pdfBlob = await renderInvoiceToBlob(pair);

        if (!pdfBlob || pdfBlob.size < 1024) {
          skipped++;
          console.warn("Tiny or empty PDF for student", studentId);
          continue;
        }

        const studentName = sanitizeFilename(pair.invoice.student.full_name);
        const fileName = `${studentName}_${month}.pdf`;
        zip.file(fileName, pdfBlob);
        success++;

        if ((i + 1) % 5 === 0 || i === targetIds.length - 1) {
          toast.message(`Progress: ${i + 1}/${targetIds.length}`);
        }
      } catch (err: any) {
        console.error("Failed for", studentId, err);
        skipped++;
      }
    }

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `invoices-${month}.zip`);
      toast.success(`Started download. ${success} ok, ${skipped} skipped.`);
    } catch (e: any) {
      toast.error(e?.message ?? "ZIP generation failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bulk Invoice Download</CardTitle>
          <CardDescription>Render each invoice to PDF and bundle into a ZIP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Download scope</label>
            <Select value={downloadType} onValueChange={(v: any) => setDownloadType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">All active students ({isLoading ? "…" : activeIds.length})</SelectItem>
                <SelectItem value="custom">Custom list</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {downloadType === "custom" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Student IDs (comma or newline separated)</label>
              <textarea
                className="w-full rounded-md border p-2 text-sm h-28"
                placeholder="uuid-1, uuid-2, ..."
                value={customIdsText}
                onChange={(e) => setCustomIdsText(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">Detected: {customIds.length}</div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleDownloadZip} disabled={downloading || (downloadType === "active" && isLoading)}>
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download ZIP ({targetIds.length})
                </>
              )}
            </Button>
            <div className="text-xs text-muted-foreground">
              Month: <span className="font-mono">{month}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
