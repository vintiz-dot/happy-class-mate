import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface HomeworkPdfDownloadProps {
  homework: {
    id: string;
    title: string;
    body?: string | null;
    due_date?: string | null;
    created_at?: string;
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
      // Create an off-screen container for rendering
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "794px"; // A4 width at 96dpi
      container.style.padding = "48px";
      container.style.background = "white";
      container.style.color = "#1a1a1a";
      container.style.fontFamily = "Arial, Helvetica, sans-serif";

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="/images/hec_logo.png" style="width: 100px; height: auto; margin: 0 auto 12px;" />
          <h1 style="font-size: 22px; font-weight: bold; color: #d4a017; margin: 0;">Happy English Club</h1>
          <p style="font-size: 11px; color: #666; margin: 4px 0 0;">Learning, an endless journey to perfection</p>
        </div>
        <hr style="border: none; border-top: 2px solid #d4a017; margin: 16px 0 24px;" />
        <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 16px; color: #111;">${escapeHtml(homework.title)}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr>
            <td style="padding: 6px 12px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold; width: 130px;">Class</td>
            <td style="padding: 6px 12px; border: 1px solid #ddd;">${escapeHtml(classNameProp || "—")}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Teacher</td>
            <td style="padding: 6px 12px; border: 1px solid #ddd;">${escapeHtml(teacherName || "—")}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Due Date</td>
            <td style="padding: 6px 12px; border: 1px solid #ddd;">${homework.due_date ? new Date(homework.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "No due date"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Posted</td>
            <td style="padding: 6px 12px; border: 1px solid #ddd;">${homework.created_at ? new Date(homework.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td>
          </tr>
        </table>
        ${homework.body ? `
          <div style="margin-top: 16px;">
            <h3 style="font-size: 15px; font-weight: bold; margin: 0 0 10px; color: #333;">Instructions</h3>
            <div style="font-size: 13px; line-height: 1.7; color: #333;">${homework.body}</div>
          </div>
        ` : ""}
        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999;">
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

      const imgWidth = 210; // A4 mm
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
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
