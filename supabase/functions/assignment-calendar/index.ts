// 1) Helpers
function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function fmtDate(y: number, m1to12: number, d: number): string {
  const mm = String(m1to12).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
function coerceISODateUTC(s: string | null): string | null {
  if (!s || !isISODate(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)); // 1..12
  const d = Number(s.slice(8, 10));
  if (!Number.isInteger(y) || m < 1 || m > 12 || !Number.isInteger(d)) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dd = Math.min(Math.max(1, d), last); // clamp 1..last
  return fmtDate(y, m, dd);
}
function parseISODateUTC(s: string): Date {
  // s must be a valid YYYY-MM-DD at this point
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d));
}
function addDaysUTC(d: Date, n: number): string {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy.toISOString().slice(0, 10);
}
