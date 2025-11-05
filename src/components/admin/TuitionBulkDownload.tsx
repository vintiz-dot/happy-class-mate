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

type Scope = "all" | "class" | "family" | "custom";

export function TuitionBulkDownload({ month }: { month: string }) {
  const [downloading, setDownloading] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [customIdsText, setCustomIdsText] = useState<string>("");

  // Pickers
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id,name").order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("id,family_name")
        .order("family_name", { ascending: true });
      if (error) throw error;
      return data as { id: string; family_name: string }[];
    },
  });

  // Resolve student IDs for the chosen scope
  const { data: scopedIds = [], isLoading: idsLoading } = useQuery({
    queryKey: ["bulk-scope-ids", scope, selectedClassId, selectedFamilyId, includeInactive],
    enabled: scope !== "custom",
    queryFn: async () => {
      const ids: string[] = [];

      if (scope === "all") {
        let q = supabase.from("students").select("id");
        if (!includeInactive) q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []).map((r: any) => r.id as string);
      }

      if (scope === "class") {
        if (!selectedClassId) return ids;

        // Try many-to-many mapping first
        const rel = await supabase.from("student_classes").select("student_id").eq("class_id", selectedClassId);
        if (rel.error) {
          console.warn("student_classes lookup failed, fallback to students.class_id. Error:", rel.error.message);
        }
        const relIds = (rel.data ?? []).map((r: any) => r.student_id as string);
        if (relIds.length > 0) {
          if (!includeInactive) {
            const { data: active, error } = await supabase
              .from("students")
              .select("id")
              .in("id", relIds)
              .eq("is_active", true);
            if (error) throw error;
            return active.map((r: any) => r.id as string);
          }
          return relIds;
        }

        // Fallback to one-to-many schema
        let q = supabase.from("students").select("id").eq("class_id", selectedClassId);
        if (!includeInactive) q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []).map((r: any) => r.id as string);
      }

      if (scope === "family") {
        if (!selectedFamilyId) return ids;
        let q = supabase.from("students").select("id").eq("family_id", selectedFamilyId);
        if (!includeInactive) q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []).map((r: any) => r.id as string);
      }

      return ids;
    },
  });

  const customIds = useMemo(() => {
    const list = customIdsText
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [customIdsText]);

  const targetIds = scope === "custom" ? customIds : scopedIds;

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

  async function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    // Force eager load for Next/Image <img loading="lazy">
    for (const img of imgs) {
      try {
        const el = img as HTMLImageElement;
        (el as any).loading = "eager";
        el.decoding = "sync";
        el.crossOrigin = "anonymous";
      } catch {}
    }
    await Promise.all(
      imgs.map((img) => {
        const el = img as HTMLImageElement;
        if (el.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          el.onload = () => resolve();
          el.onerror = () => resolve();
        });
      }),
    );
    // Decode to ensure ready to paint
    await Promise.all(
      imgs.map((img) => {
        const el = img as HTMLImageElement;
        return typeof el.decode === "function" ? el.decode().catch(() => {}) : Promise.resolve();
      }),
    );
  }

  function nextFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function waitForFonts() {
    try {
      // @ts-ignore
      if (document.fonts && typeof document.fonts.ready?.then === "function") {
        // @ts-ignore
        await document.fonts.ready;
      }
    } catch {}
  }

  async function ensureLaidOut(el: HTMLElement) {
    await nextFrame();
    await new Promise((r) => setTimeout(r, 40));
    // Force reflow
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;
    await nextFrame();
  }

  async function renderInvoiceToBlob(pair: Pair): Promise<Blob> {
    // Create container in viewport but invisible to users
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "794px"; // ~A4 at 96dpi
    container.style.minHeight = "1123px"; // keep aspect
    container.style.background = "#ffffff";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.style.zIndex = "-1";
    container.className = "print-container";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<InvoicePrintView invoice={pair.invoice} bankInfo={pair.bankInfo} />);

    // Allow layout, fonts, and images
    await ensureLaidOut(container);
    await waitForFonts();
    await waitForImages(container);
    await ensureLaidOut(container);

    // Verify size
    const w = container.scrollWidth || container.offsetWidth;
    const h = container.scrollHeight || container.offsetHeight;
    if (!w || !h) {
      console.warn("Zero-size invoice DOM. Width:", w, "Height:", h);
    }

    const h2p: any = (html2pdf as any)?.default ?? (html2pdf as any);
    const baseOpts = {
      margin: [10, 10, 10, 10],
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        imageTimeout: 0,
        logging: false,
        windowWidth: w || 794,
      },
      pagebreak: { mode: ["css", "legacy"] as any },
      filename: "tmp.pdf",
    };

    try {
      // First attempt
      let blob: Blob = await h2p()
        .from(container)
        .set(baseOpts)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => pdf.output("blob"));

      // Fallback with higher scale if tiny
      if (!blob || blob.size < 2048) {
        console.warn("Retrying html2pdf at higher scale");
        const retryOpts = {
          ...baseOpts,
          html2canvas: { ...baseOpts.html2canvas, scale: 3 },
        };
        blob = await h2p()
          .from(container)
          .set(retryOpts)
          .toPdf()
          .get("pdf")
          .then((pdf: any) => pdf.output("blob"));
      }

      return blob;
    } finally {
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
    if (scope === "class" && !selectedClassId) {
      toast.error("Select a class");
      return;
    }
    if (scope === "family" && !selectedFamilyId) {
      toast.error("Select a family");
      return;
    }
    if (scope === "custom" && customIds.length === 0) {
      toast.error("Provide at least one student ID");
      return;
    }

    const targetIds = scope === "custom" ? customIds : scopedIds;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Select value={scope} onValueChange={(v: Scope) => setScope(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students</SelectItem>
                  <SelectItem value="class">By class</SelectItem>
                  <SelectItem value="family">By family</SelectItem>
                  <SelectItem value="custom">Custom IDs</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm mt-2 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                />
                Include inactive students
              </label>
            </div>

            {scope === "class" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "family" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Family</label>
                <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a family" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.family_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {scope === "custom" && (
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
            <Button onClick={handleDownloadZip} disabled={downloading || (scope !== "custom" && idsLoading)}>
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
