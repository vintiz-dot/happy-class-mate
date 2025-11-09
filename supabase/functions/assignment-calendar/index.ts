// supabase/functions/assignment-calendar/index.ts
// Deno Edge Function: returns assignments within a month or explicit date range.
// Backward-compatible inputs:
//   ?year=2025&month=11          // 1..12 (primary)
//   ?year=2025&month=10          // 0..11 (zero-based accepted)
//   ?ym=2025-11                  // year-month shorthand
//   ?from=2025-11-01&to=2025-11-30
//
// Response shape (stable):
// {
//   "from": "YYYY-MM-DD",
//   "to": "YYYY-MM-DD",
//   "items": [...],                // raw rows
//   "days": [{ date, items, count }] // month calendar buckets
// }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type HomeworkRow = {
  id: string;
  title?: string | null;
  due_date?: string | null; // DATE or TIMESTAMP stored as ISO date
  class_id?: string | null;
  classes?: { id: string; name?: string | null } | null;
};

serve(async (req) => {
  // Basic CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req.headers) });
  }

  try {
    const url = new URL(req.url);
    const { from, to, daysInMonth } = computeRange(url.searchParams);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!; // or SERVICE_ROLE for server-side needs
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Query: adjust the select to your schema. Keep due_date filtering inclusive.
    const { data, error } = await supabase
      .from("homeworks")
      .select("id,title,due_date,class_id,classes(id,name)")
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true });

    if (error) throw error;

    const items = (data ?? []) as HomeworkRow[];

    // Bucket into calendar days for the month range, but do not assume 31 days.
    const dayIndex: Record<string, HomeworkRow[]> = {};
    // Seed buckets for the whole month only when the range is exactly a full month.
    const isWholeMonth = isFirstOfMonth(from) && isLastOfMonth(to);
    if (isWholeMonth) {
      const y = Number(from.slice(0, 4));
      const m = Number(from.slice(5, 7)); // 1..12
      for (let d = 1; d <= daysInMonth; d++) {
        const key = fmtDate(y, m, d);
        dayIndex[key] = [];
      }
    }

    for (const row of items) {
      const key = normalizeDateKey(row.due_date);
      if (!key) continue;
      if (!dayIndex[key]) dayIndex[key] = [];
      dayIndex[key].push(row);
    }

    const days = Object.keys(dayIndex)
      .sort()
      .map((date) => ({ date, items: dayIndex[date], count: dayIndex[date].length }));

    return json({ from, to, items, days }, 200, req.headers);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400, req.headers);
  }
});

/* --------------------------- helpers --------------------------- */

function corsHeaders(reqHeaders: HeadersInit) {
  const origin = (reqHeaders as Headers).get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(body: unknown, status: number, reqHeaders: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(reqHeaders),
  });
}

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseISODateUTC(s: string): Date | null {
  if (!isISODate(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)); // 1..12
  const d = Number(s.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Validate round-trip to catch impossible dates like 2025-11-31
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function fmtDate(y: number, m1to12: number, d: number): string {
  const mm = String(m1to12).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function normalizeDateKey(value?: string | null): string | null {
  if (!value) return null;
  // Accept DATE or TIMESTAMP. Use UTC slice.
  // e.g., "2025-11-14", or "2025-11-14T00:00:00Z"
  if (isISODate(value)) return value;
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  return m ? m[1] : null;
}

function isFirstOfMonth(iso: string): boolean {
  return iso.endsWith("-01");
}
function isLastOfMonth(iso: string): boolean {
  const dt = parseISODateUTC(iso);
  if (!dt) return false;
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return dt.getUTCDate() === last;
}

function computeRange(search: URLSearchParams): { from: string; to: string; daysInMonth: number } {
  // 1) Explicit from/to wins if both valid
  const fromParam = search.get("from");
  const toParam = search.get("to");
  if (fromParam && toParam) {
    const fromDt = parseISODateUTC(fromParam);
    const toDt = parseISODateUTC(toParam);
    if (!fromDt || !toDt) throw new Error("invalid from/to");
    if (toDt < fromDt) throw new Error("to must be >= from");
    const y = fromDt.getUTCFullYear();
    const m = fromDt.getUTCMonth() + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      from: fromParam,
      to: toParam,
      daysInMonth: last, // best-effort; used only when range happens to be whole month
    };
  }

  // 2) ym=YYYY-MM shorthand
  const ym = search.get("ym");
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7));
    return monthBounds(y, m);
  }

  // 3) year + month (accept 1..12 and zero-based 0..11)
  const now = new Date();
  const y = toInt(search.get("year"), now.getUTCFullYear());
  const mRaw = search.get("month");
  let m: number;
  if (mRaw === null) {
    m = now.getUTCMonth() + 1; // default current month in UTC
  } else {
    const n = Number(mRaw);
    if (!Number.isFinite(n)) throw new Error("invalid month");
    if (n >= 1 && n <= 12)
      m = n; // canonical 1..12
    else if (n >= 0 && n <= 11)
      m = n + 1; // zero-based accepted
    else throw new Error("invalid month");
  }

  return monthBounds(y, m);
}

function monthBounds(y: number, m1to12: number): { from: string; to: string; daysInMonth: number } {
  if (!Number.isInteger(y) || y < 1 || y > 9999) throw new Error("invalid year");
  if (!Number.isInteger(m1to12) || m1to12 < 1 || m1to12 > 12) throw new Error("invalid month");
  const start = new Date(Date.UTC(y, m1to12 - 1, 1)); // first day
  const end = new Date(Date.UTC(y, m1to12, 0)); // last day of month
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const daysInMonth = end.getUTCDate();
  return { from, to, daysInMonth };
}

function toInt(v: string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error("invalid year");
  return n;
}
