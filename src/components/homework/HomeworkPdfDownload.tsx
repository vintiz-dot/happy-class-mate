import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { logPdfEvent, newExportId } from "@/lib/pdfExportLog";

interface HomeworkPdfDownloadProps {
  homework: {
    id: string;
    title: string;
    body?: string | null;
    due_date?: string | null;
    created_at?: string;
    class_id?: string;
    classes?: { name: string } | null;
  };
  className?: string;
  teacherName?: string;
  variant?: "icon" | "button" | "pill" | "pill-compact";
}

// A4 in mm
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 15;
const PRINTABLE_W_MM = PAGE_W_MM - MARGIN_MM * 2; // 180
const PRINTABLE_H_MM = PAGE_H_MM - MARGIN_MM * 2; // 267
const CONTAINER_W_PX = 720;
// Lower scale = ~3-4x faster html2canvas, still readable on screen and print.
const RENDER_SCALE = 1.5;
// JPEG quality balance: 0.82 ~= half the bytes of 0.92 with no visible diff in text PDFs.
const JPEG_QUALITY = 0.82;

export function HomeworkPdfDownload({ homework, className: classNameProp, teacherName, variant = "button" }: HomeworkPdfDownloadProps) {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    const exportId = newExportId();
    const t0 = performance.now();
    const log = (level: "info" | "warn" | "error", step: string, data?: any) =>
      logPdfEvent({
        level,
        step,
        exportId,
        homeworkId: homework.id,
        homeworkTitle: homework.title,
        data,
      });
    log("info", "export.start", { variant, hasBody: !!homework.body, bodyLen: (homework.body || "").length });

    let container: HTMLDivElement | null = null;
    try {
      // Resolve teacher / class name if missing
      let resolvedTeacher = teacherName || "";
      let resolvedClass = classNameProp || homework.classes?.name || "";

      if ((!resolvedTeacher || resolvedTeacher === "—") && homework.class_id) {
        const { data } = await supabase
          .from("classes")
          .select("name, default_teacher_id, teachers(full_name)")
          .eq("id", homework.class_id)
          .single();
        if (data) {
          if (!resolvedClass) resolvedClass = data.name || "";
          resolvedTeacher = (data.teachers as any)?.full_name || "—";
        }
      }

      const transformedBody = transformLinks(homework.body || "");

      // Build a single offscreen container with all content.
      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "0";
      container.style.zIndex = "-1";
      container.style.opacity = "0";
      container.style.pointerEvents = "none";
      container.style.width = `${CONTAINER_W_PX}px`;
      container.style.padding = "0";
      container.style.background = "white";
      container.style.color = "#1a1a1a";
      container.style.fontFamily = "Helvetica, Arial, sans-serif";
      container.style.boxSizing = "border-box";
      container.style.fontSize = "13px";
      container.style.lineHeight = "1.6";

      const dueDateStr = homework.due_date
        ? new Date(homework.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "No due date";
      const postedStr = homework.created_at
        ? new Date(homework.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "—";

      container.innerHTML = `
        <div style="text-align: center; padding-bottom: 8px;">
          <img src="/images/hec_logo.png" crossorigin="anonymous" style="width: 80px; height: auto; margin: 0 auto 8px; display: block;" onerror="this.style.display='none'" />
          <h1 style="font-size: 20px; font-weight: bold; color: #d4a017; margin: 0;">Happy English Club</h1>
          <p style="font-size: 11px; color: #666; margin: 4px 0 0;">Learning, an endless journey to perfection</p>
          <hr style="border: none; border-top: 2px solid #d4a017; margin: 10px 0 0;" />
        </div>
        <div style="padding-top: 10px;">
          <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 12px; color: #111; word-wrap: break-word; overflow-wrap: anywhere;">${escapeHtml(homework.title)}</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed;">
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold; width: 110px;">Class</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: anywhere;">${escapeHtml(resolvedClass || "—")}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Teacher</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: anywhere;">${escapeHtml(resolvedTeacher || "—")}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Due Date</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">${dueDateStr}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Posted</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">${postedStr}</td>
            </tr>
          </table>
        </div>
        ${transformedBody ? `
          <div style="padding-top: 14px;">
            <h3 style="font-size: 14px; font-weight: bold; margin: 0 0 8px; color: #333;">Instructions</h3>
            <div class="hw-body" style="font-size: 13px; line-height: 1.7; color: #333;">
              ${transformedBody}
            </div>
          </div>
        ` : ""}
        <div style="margin-top: 18px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999;">
          Happy English Club &bull; Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <style>
          .hw-body { word-wrap: break-word; overflow-wrap: anywhere; }
          .hw-body * { max-width: 100% !important; overflow-wrap: anywhere !important; word-break: break-word !important; box-sizing: border-box; }
          .hw-body a { color: #2563eb !important; text-decoration: underline !important; font-weight: 600 !important; }
          .hw-body img { max-width: 100% !important; height: auto !important; display: block; margin: 8px 0; }
          .hw-body p { margin: 0 0 10px !important; }
          .hw-body h1, .hw-body h2, .hw-body h3, .hw-body h4 { margin: 12px 0 8px !important; line-height: 1.3 !important; }
          .hw-body ul, .hw-body ol { padding-left: 22px !important; margin: 0 0 10px !important; }
          .hw-body li { margin-bottom: 4px !important; }
          .hw-body blockquote { border-left: 3px solid #d4a017; padding-left: 10px; margin: 8px 0; color: #555; }
          .hw-body pre, .hw-body code { white-space: pre-wrap !important; background: #f5f5f5; padding: 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
          .hw-body table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; margin: 8px 0 !important; }
          .hw-body td, .hw-body th { padding: 6px 8px !important; border: 1px solid #ddd !important; word-wrap: break-word !important; font-size: 12px !important; vertical-align: top; }
        </style>
      `;

      document.body.appendChild(container);

      const fileName = `${homework.title.replace(/[^a-zA-Z0-9]/g, "_")}_homework.pdf`;
      const pdf = new jsPDF("p", "mm", "a4");

      // Wait for fonts (cheap when already loaded).
      if ((document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch {}
      }

      // Wait for images, but cap aggressively — 700ms is plenty for cached/local assets.
      const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
      if (imgs.length > 0) {
        await Promise.race([
          Promise.all(
            imgs.map(
              (img) =>
                new Promise<void>((resolve) => {
                  if (img.complete && img.naturalHeight > 0) return resolve();
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                })
            )
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 700)),
        ]);
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const t1 = performance.now();
      log("info", "render.start", { containerHeight: container.offsetHeight });

      // ONE html2canvas call for the whole document (was N before, ~3-5x faster).
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: RENDER_SCALE,
        useCORS: true,
        logging: false,
        windowWidth: CONTAINER_W_PX,
      });

      const t2 = performance.now();
      log("info", "render.done", { canvasW: canvas.width, canvasH: canvas.height, ms: Math.round(t2 - t1) });

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Empty canvas");
      }

      // Slice the single canvas into A4-page-sized strips.
      const pxPerMm = canvas.width / PRINTABLE_W_MM;
      const pageHeightPx = Math.floor(PRINTABLE_H_MM * pxPerMm);
      const totalHeightPx = canvas.height;

      let offsetPx = 0;
      let pageIndex = 0;
      while (offsetPx < totalHeightPx) {
        const sliceHpx = Math.min(pageHeightPx, totalHeightPx - offsetPx);

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

        const sliceHmm = sliceHpx / pxPerMm;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          sliceCanvas.toDataURL("image/jpeg", JPEG_QUALITY),
          "JPEG",
          MARGIN_MM,
          MARGIN_MM,
          PRINTABLE_W_MM,
          sliceHmm
        );

        offsetPx += sliceHpx;
        pageIndex += 1;
      }

      try {
        pdf.save(fileName);
        const total = Math.round(performance.now() - t0);
        log("info", "export.saved", { fileName, totalMs: total, pages: pageIndex });
        toast.success(`PDF downloaded (${pageIndex} ${pageIndex === 1 ? "page" : "pages"})`);
      } catch (saveErr: any) {
        log("error", "export.save-error", { message: saveErr?.message });
        throw saveErr;
      }
    } catch (err: any) {
      console.error("PDF generation error:", err);
      log("error", "export.fatal", { message: err?.message, stack: err?.stack });
      toast.error("Failed to generate PDF — check Teacher Profile → PDF Diagnostics for details");
    } finally {
      if (container && container.parentNode) document.body.removeChild(container);
      setGenerating(false);
    }
  };

  if (variant === "icon") {
    return (
      <Button variant="ghost" size="icon" onClick={generate} disabled={generating} title="Download as PDF">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>
    );
  }

  if (variant === "pill-compact") {
    return (
      <Button
        onClick={generate}
        disabled={generating}
        size="sm"
        className="h-8 rounded-full gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold text-xs"
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
      </Button>
    );
  }

  if (variant === "pill") {
    return (
      <Button
        onClick={generate}
        disabled={generating}
        className="h-10 min-h-[40px] rounded-full gap-2 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {generating ? "Generating..." : "Download PDF"}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-2">
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {generating ? "Generating..." : "Download PDF"}
    </Button>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function transformLinks(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const anchors = tmp.querySelectorAll("a");
  anchors.forEach((a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (!href) return;
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    const visible = (a.textContent || "").trim();
    if (visible && visible !== href && !visible.includes(href)) {
      const span = document.createElement("span");
      span.style.color = "#666";
      span.style.fontSize = "0.9em";
      span.textContent = ` (${href})`;
      a.after(span);
    }
  });
  return tmp.innerHTML;
}
