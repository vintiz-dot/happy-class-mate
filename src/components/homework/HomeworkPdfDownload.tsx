import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
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

      // Transform homework body so links stay clickable AND show their full URL
      const transformedBody = transformLinks(homework.body || "");

      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "680px";
      container.style.padding = "0";
      container.style.background = "white";
      container.style.color = "#1a1a1a";
      container.style.fontFamily = "Helvetica, Arial, sans-serif";
      container.style.boxSizing = "border-box";
      container.style.fontSize = "12px";
      container.style.lineHeight = "1.6";

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="/images/hec_logo.png" crossorigin="anonymous" style="width: 80px; height: auto; margin: 0 auto 8px; display: block;" />
          <h1 style="font-size: 18px; font-weight: bold; color: #d4a017; margin: 0;">Happy English Club</h1>
          <p style="font-size: 10px; color: #666; margin: 4px 0 0;">Learning, an endless journey to perfection</p>
        </div>
        <hr style="border: none; border-top: 2px solid #d4a017; margin: 10px 0 16px;" />
        <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 12px; color: #111; word-wrap: break-word;">${escapeHtml(homework.title)}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; table-layout: fixed;">
          <tr>
            <td style="padding: 5px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold; width: 100px;">Class</td>
            <td style="padding: 5px 8px; border: 1px solid #ddd; word-wrap: break-word;">${escapeHtml(resolvedClass || "—")}</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Teacher</td>
            <td style="padding: 5px 8px; border: 1px solid #ddd; word-wrap: break-word;">${escapeHtml(resolvedTeacher || "—")}</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Due Date</td>
            <td style="padding: 5px 8px; border: 1px solid #ddd;">${homework.due_date ? new Date(homework.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "No due date"}</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Posted</td>
            <td style="padding: 5px 8px; border: 1px solid #ddd;">${homework.created_at ? new Date(homework.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td>
          </tr>
        </table>
        ${transformedBody ? `
          <div style="margin-top: 12px;">
            <h3 style="font-size: 13px; font-weight: bold; margin: 0 0 8px; color: #333;">Instructions</h3>
            <div class="hw-body" style="font-size: 12px; line-height: 1.7; color: #333; word-wrap: break-word; overflow-wrap: anywhere;">
              ${transformedBody}
            </div>
          </div>
        ` : ""}
        <div style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #999;">
          Happy English Club &bull; Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <style>
          .hw-body * { max-width: 100% !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
          .hw-body a { color: #2563eb !important; text-decoration: underline !important; font-weight: 600 !important; }
          .hw-body img { max-width: 100% !important; height: auto !important; }
          .hw-body p { margin: 0 0 8px !important; }
          .hw-body ul, .hw-body ol { padding-left: 20px !important; margin: 0 0 8px !important; }
          .hw-body table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
          .hw-body td, .hw-body th { padding: 4px 8px !important; border: 1px solid #ddd !important; word-wrap: break-word !important; font-size: 11px !important; }
        </style>
      `;

      document.body.appendChild(container);

      const pdf = new jsPDF("p", "mm", "a4");
      const fileName = `${homework.title.replace(/[^a-zA-Z0-9]/g, "_")}_homework.pdf`;

      try {
        // Preferred path: jsPDF.html() preserves real selectable text + clickable links
        await pdf.html(container, {
          callback: (doc) => {
            doc.save(fileName);
          },
          margin: [15, 15, 15, 15],
          autoPaging: "text",
          width: 180, // 210mm A4 - 2*15mm margin
          windowWidth: 680, // matches container width above
          html2canvas: {
            scale: 180 / 680,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
          } as any,
        });
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
    // Compact labeled pill — fits in card badge rows
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
    // Prominent labeled pill — for detail views and grading lists
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

/**
 * Walks rendered HTML and:
 * - Ensures every <a> has http(s) href, target=_blank
 * - Appends "(full url)" after the link text when the visible text differs from the URL,
 *   so printed copies still expose the destination.
 */
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
    // Only append URL when it adds info (text doesn't already contain it)
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
