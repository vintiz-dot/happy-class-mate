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
  variant?: "icon" | "button";
}

export function HomeworkPdfDownload({ homework, className: classNameProp, teacherName, variant = "button" }: HomeworkPdfDownloadProps) {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      // Resolve teacher name if not provided
      let resolvedTeacher = teacherName || "";
      let resolvedClass = classNameProp || (homework.classes?.name) || "";

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

      // Container width = A4 at 96dpi minus margins (padding handles margins)
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "700px";
      container.style.padding = "0";
      container.style.background = "white";
      container.style.color = "#1a1a1a";
      container.style.fontFamily = "Arial, Helvetica, sans-serif";
      container.style.boxSizing = "border-box";

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="/images/hec_logo.png" style="width: 90px; height: auto; margin: 0 auto 10px; display: block;" />
          <h1 style="font-size: 20px; font-weight: bold; color: #d4a017; margin: 0; line-height: 1.3;">Happy English Club</h1>
          <p style="font-size: 10px; color: #666; margin: 4px 0 0;">Learning, an endless journey to perfection</p>
        </div>
        <hr style="border: none; border-top: 2px solid #d4a017; margin: 12px 0 18px;" />
        <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 14px; color: #111; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(homework.title)}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; table-layout: fixed;">
          <tr>
            <td style="padding: 5px 10px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold; width: 110px;">Class</td>
            <td style="padding: 5px 10px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(resolvedClass || "—")}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Teacher</td>
            <td style="padding: 5px 10px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(resolvedTeacher || "—")}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Due Date</td>
            <td style="padding: 5px 10px; border: 1px solid #ddd;">${homework.due_date ? new Date(homework.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "No due date"}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Posted</td>
            <td style="padding: 5px 10px; border: 1px solid #ddd;">${homework.created_at ? new Date(homework.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td>
          </tr>
        </table>
        ${homework.body ? `
          <div style="margin-top: 14px;">
            <h3 style="font-size: 14px; font-weight: bold; margin: 0 0 8px; color: #333;">Instructions</h3>
            <div style="font-size: 12px; line-height: 1.7; color: #333; word-wrap: break-word; overflow-wrap: break-word; overflow-wrap: anywhere;">
              <style>
                .hw-body * { max-width: 100% !important; overflow-wrap: break-word !important; word-break: break-word !important; }
                .hw-body table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
                .hw-body td, .hw-body th { padding: 4px 8px !important; border: 1px solid #ddd !important; word-wrap: break-word !important; overflow-wrap: break-word !important; font-size: 12px !important; }
                .hw-body img { max-width: 100% !important; height: auto !important; }
                .hw-body p { margin: 0 0 8px !important; }
              </style>
              <div class="hw-body">${homework.body}</div>
            </div>
          </div>
        ` : ""}
        <div style="margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 9px; color: #999;">
          Happy English Club &bull; Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(container);

      const marginMm = 15;
      const contentWidthMm = 210 - marginMm * 2; // 180mm
      const pageContentHeight = 297 - marginMm * 2; // 267mm
      const imgHeight = (canvas.height * contentWidthMm) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");

      let heightLeft = imgHeight;
      let position = marginMm;

      pdf.addImage(imgData, "PNG", marginMm, position, contentWidthMm, imgHeight);
      heightLeft -= pageContentHeight;

      while (heightLeft > 0) {
        position = marginMm - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", marginMm, position, contentWidthMm, imgHeight);
        heightLeft -= pageContentHeight;
      }

      pdf.save(`${homework.title.replace(/[^a-zA-Z0-9]/g, "_")}_homework.pdf`);
      toast.success("PDF downloaded!");
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
