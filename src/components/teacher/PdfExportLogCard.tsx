import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, RefreshCw, FileWarning } from "lucide-react";
import { clearPdfLog, downloadPdfLog, getPdfLog, type PdfLogEntry } from "@/lib/pdfExportLog";
import { toast } from "sonner";

export function PdfExportLogCard() {
  const [entries, setEntries] = useState<PdfLogEntry[]>([]);

  const refresh = () => setEntries(getPdfLog());

  useEffect(() => {
    refresh();
  }, []);

  const errorCount = entries.filter((e) => e.level === "error").length;
  const warnCount = entries.filter((e) => e.level === "warn").length;
  const exportIds = Array.from(new Set(entries.map((e) => e.exportId)));
  const recent = entries.slice(-25).reverse();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              PDF Export Diagnostics
            </CardTitle>
            <CardDescription>
              Per-anchor mapping results and caught errors from homework PDF exports run on this device.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refresh();
                toast.success("Log refreshed");
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (entries.length === 0) {
                  toast.error("No log entries to download yet. Trigger a PDF export first.");
                  return;
                }
                downloadPdfLog();
                toast.success("Log downloaded");
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download log
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearPdfLog();
                refresh();
                toast.success("Log cleared");
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">Entries: {entries.length}</Badge>
          <Badge variant="secondary">Exports: {exportIds.length}</Badge>
          <Badge variant={warnCount > 0 ? "default" : "secondary"}>Warnings: {warnCount}</Badge>
          <Badge variant={errorCount > 0 ? "destructive" : "secondary"}>Errors: {errorCount}</Badge>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries yet. Open a homework and trigger a PDF download to capture diagnostics, then refresh.
          </p>
        ) : (
          <div className="rounded-md border max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Lvl</th>
                  <th className="text-left p-2">Export</th>
                  <th className="text-left p-2">Step</th>
                  <th className="text-left p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap font-mono">{new Date(e.ts).toLocaleTimeString()}</td>
                    <td className="p-2">
                      <Badge
                        variant={e.level === "error" ? "destructive" : e.level === "warn" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {e.level}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono">{e.exportId.slice(0, 8)}</td>
                    <td className="p-2 font-medium">{e.step}</td>
                    <td className="p-2">
                      <code className="text-[10px] break-all">
                        {e.data ? JSON.stringify(e.data).slice(0, 200) : ""}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Log is stored locally in this browser. Download it and share the JSON file when reporting a failed export.
        </p>
      </CardContent>
    </Card>
  );
}
