// Simple in-memory + localStorage-backed log store for PDF export diagnostics.
// Used by HomeworkPdfDownload to capture per-export step traces, link mapping
// results, and caught errors. Exposed via teacher profile for download.

export type PdfLogLevel = "info" | "warn" | "error";

export interface PdfLogEntry {
  ts: string;
  level: PdfLogLevel;
  exportId: string;
  homeworkId?: string;
  homeworkTitle?: string;
  step: string;
  data?: any;
}

const STORAGE_KEY = "pdf_export_log_v1";
const MAX_ENTRIES = 500;

function safeRead(): PdfLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(-MAX_ENTRIES);
    return [];
  } catch {
    return [];
  }
}

function safeWrite(entries: PdfLogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota — ignore */
  }
}

export function logPdfEvent(entry: Omit<PdfLogEntry, "ts">) {
  const full: PdfLogEntry = { ts: new Date().toISOString(), ...entry };
  const all = safeRead();
  all.push(full);
  safeWrite(all);
  // mirror to console for live debugging
  const fn = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;
  fn(`[pdf-export ${entry.exportId}] ${entry.step}`, entry.data ?? "");
}

export function getPdfLog(): PdfLogEntry[] {
  return safeRead();
}

export function clearPdfLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function downloadPdfLog(filename = `pdf-export-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`) {
  const entries = getPdfLog();
  const payload = {
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    entryCount: entries.length,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function newExportId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
