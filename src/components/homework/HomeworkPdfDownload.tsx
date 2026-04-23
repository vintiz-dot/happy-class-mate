import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";

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

// A4 @ 96dpi-ish working units in mm
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 15;
const PRINTABLE_W_MM = PAGE_W_MM - MARGIN_MM * 2; // 180
const PRINTABLE_H_MM = PAGE_H_MM - MARGIN_MM * 2; // 267
const CONTAINER_W_PX = 720; // matches printable width visually; mm conversion = px * (180/720)
const PX_TO_MM = PRINTABLE_W_MM / CONTAINER_W_PX;
const BLOCK_GAP_MM = 2;

export function HomeworkPdfDownload({ homework, className: classNameProp, teacherName, variant = "button" }: HomeworkPdfDownloadProps) {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
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

      // Build container
      const container = document.createElement("div");
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
        <div data-pdf-block style="text-align: center; padding-bottom: 8px;">
          <img src="/images/hec_logo.png" crossorigin="anonymous" style="width: 80px; height: auto; margin: 0 auto 8px; display: block;" onerror="this.style.display='none'" />
          <h1 style="font-size: 20px; font-weight: bold; color: #d4a017; margin: 0;">Happy English Club</h1>
          <p style="font-size: 11px; color: #666; margin: 4px 0 0;">Learning, an endless journey to perfection</p>
          <hr style="border: none; border-top: 2px solid #d4a017; margin: 10px 0 0;" />
        </div>
        <div data-pdf-block style="padding-top: 10px;">
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
          <div data-pdf-block style="padding-top: 14px;">
            <h3 style="font-size: 14px; font-weight: bold; margin: 0 0 8px; color: #333;">Instructions</h3>
          </div>
          <div id="pdf-body-root" class="hw-body" style="font-size: 13px; line-height: 1.7; color: #333;">
            ${transformedBody}
          </div>
        ` : ""}
        <div data-pdf-block data-pdf-footer style="margin-top: 18px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999;">
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

      try {
        // Wait for fonts
        if ((document as any).fonts?.ready) {
          try { await (document as any).fonts.ready; } catch {}
        }
        // Wait for images
        const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
        await Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete && img.naturalHeight > 0) return resolve();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(() => resolve(), 1500);
              })
          )
        );
        // Layout settle
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 50));

        // Collect blocks: top-level [data-pdf-block] + body chunks
        const blocks: HTMLElement[] = [];
        container.querySelectorAll(":scope > [data-pdf-block]").forEach((el) => {
          if (!el.hasAttribute("data-pdf-footer")) blocks.push(el as HTMLElement);
        });

        const bodyRoot = container.querySelector("#pdf-body-root") as HTMLElement | null;
        if (bodyRoot) {
          // Wrap each top-level child as its own block
          const children = Array.from(bodyRoot.children) as HTMLElement[];
          if (children.length === 0 && bodyRoot.textContent?.trim()) {
            blocks.push(bodyRoot);
          } else {
            children.forEach((c) => blocks.push(c));
          }
        }

        const footer = container.querySelector("[data-pdf-footer]") as HTMLElement | null;

        // Pagination state
        let cursorY = MARGIN_MM;

        const ensureSpace = (heightMm: number) => {
          if (cursorY + heightMm > PAGE_H_MM - MARGIN_MM) {
            pdf.addPage();
            cursorY = MARGIN_MM;
          }
        };

        const renderElementToPdf = async (el: HTMLElement) => {
          if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
          try {
            const canvas = await html2canvas(el, {
              backgroundColor: "#ffffff",
              scale: 2,
              useCORS: true,
              logging: false,
              windowWidth: CONTAINER_W_PX,
            });
            if (canvas.width === 0 || canvas.height === 0) return;

            const imgWmm = PRINTABLE_W_MM;
            const imgHmm = (canvas.height * imgWmm) / canvas.width;

            // If single block taller than full page, slice the canvas
            if (imgHmm > PRINTABLE_H_MM) {
              const sliceHeightMm = PRINTABLE_H_MM;
              const totalHmm = imgHmm;
              let consumedMm = 0;
              while (consumedMm < totalHmm) {
                const remainingMm = totalHmm - consumedMm;
                const thisSliceMm = Math.min(sliceHeightMm, remainingMm);
                // pixels to slice
                const sliceCanvas = document.createElement("canvas");
                const pxPerMm = canvas.width / imgWmm;
                const sliceHpx = Math.floor(thisSliceMm * pxPerMm);
                const sliceYpx = Math.floor(consumedMm * pxPerMm);
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceHpx;
                const ctx = sliceCanvas.getContext("2d");
                if (!ctx) break;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                ctx.drawImage(canvas, 0, sliceYpx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
                if (cursorY !== MARGIN_MM) {
                  pdf.addPage();
                  cursorY = MARGIN_MM;
                }
                pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM, cursorY, imgWmm, thisSliceMm);
                cursorY += thisSliceMm;
                consumedMm += thisSliceMm;
                if (consumedMm < totalHmm) {
                  pdf.addPage();
                  cursorY = MARGIN_MM;
                }
              }
              cursorY += BLOCK_GAP_MM;
              return;
            }

            ensureSpace(imgHmm);
            const blockTopY = cursorY;
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM, blockTopY, imgWmm, imgHmm);

            // Map links inside this element to PDF coordinates (best-effort, never throws)
            try {
              const elRect = el.getBoundingClientRect();
              const anchors = Array.from(el.querySelectorAll("a")) as HTMLAnchorElement[];
              anchors.forEach((a) => {
                try {
                  const href = a.getAttribute("href");
                  if (!href) return;
                  const r = a.getBoundingClientRect();
                  if (!r || r.width === 0 || r.height === 0) return;
                  const relTop = r.top - elRect.top;
                  const relLeft = r.left - elRect.left;
                  if (relTop < 0 || relLeft < 0) return;
                  const xMm = MARGIN_MM + relLeft * PX_TO_MM;
                  const yMm = blockTopY + relTop * PX_TO_MM;
                  const wMm = Math.min(r.width * PX_TO_MM, imgWmm);
                  const hMm = r.height * PX_TO_MM;
                  if (yMm + hMm > PAGE_H_MM - MARGIN_MM) return;
                  pdf.link(xMm, yMm, wMm, hMm, { url: href });
                } catch {}
              });
            } catch {}

            cursorY += imgHmm + BLOCK_GAP_MM;
          } catch (err) {
            console.warn("Block render skipped:", err);
          }
        };

        for (const block of blocks) {
          await renderElementToPdf(block);
        }

        // Footer on last page
        if (footer) {
          const footerCanvas = await html2canvas(footer, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: CONTAINER_W_PX,
          });
          const fH = (footerCanvas.height * PRINTABLE_W_MM) / footerCanvas.width;
          ensureSpace(fH);
          pdf.addImage(footerCanvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM, cursorY, PRINTABLE_W_MM, fH);
        }

        pdf.save(fileName);
        toast.success("PDF downloaded!");
      } finally {
        if (container.parentNode) document.body.removeChild(container);
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
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
