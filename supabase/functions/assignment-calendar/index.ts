// supabase/functions/assignment-calendar/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type HomeworkRow = {
  id: string;
  title?: string | null;
  due_date?: string | null;
  class_id?: string | null;
  classes?: { id: string; name?: string | null } | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers) });

  try {
    const url = new URL(req.url);
    const { from, to, daysInMonth } = computeRange(url.searchParams);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data, error } = await supabase
      .from("homeworks")
      .select("id,title,due_date,class_id,classes(id,name)")
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true });

    if (error) throw error;

    const items = (data ?? []) as HomeworkRow[];
    const dayIndex: Record<string, HomeworkRow[]> = {};

    const isWholeMonth = isFirstOfMonth(from) && isLastOfMonth(to);
    if (isWholeMonth) {
      const y = Number(from.slice(0, 4));
      const m = Number(from.slice(5, 7)); // 1..12
      for (let d = 1; d <= daysInMonth; d++) {
        dayIndex[fmtDate(y, m, d)] = [];
      }
    }

    for (const row of items) {
      const key = normalizeDateKey(row.due_date);
      if (!key) continue;
      (dayIndex[key] ??= []).push(row);
    }

    const days = Object.keys(dayIndex)
      .sort()
      .map((date) => ({ date, items: dayIndex[date], count: dayIndex[date].length }));

    return json({ from, to, items, days }, 200, req.headers);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400, req.headers);
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
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(reqHeaders) });
}

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function fmtDate(y: number, m1to12: number, d: number): string {
  const mm = String(m1to12).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function normalizeDateKey(value?: string | null): string | null {
  if (!value) return null;
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
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  return dt.getUTCDate() === last;
}

function parseISODateUTC(s: string): Date | null {
  if (!isISODate(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // strict check
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Tolerant: clamps an invalid day to the month's last valid day. */
function coerceISODateUTC(s: string): string | null {
  if (!isISODate(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)); // 1..12
  const d = Number(s.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dd = Math.min(Math.max(1, d), last);
  return fmtDate(y, m, dd);
}

function monthBounds(y: number, m1to12: number): { from: string; to: string; daysInMonth: number } {
  if (!Number.isInteger(y) || y < 1 || y > 9999) throw new Error("invalid year");
  if (!Number.isInteger(m1to12) || m1to12 < 1 || m1to12 > 12) throw new Error("invalid month");
  const start = new Date(Date.UTC(y, m1to12 - 1, 1));
  const end = new Date(Date.UTC(y, m1to12, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    daysInMonth: end.getUTCDate(),
  };
}

function toInt(v: string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error("invalid year");
  return n;
}

function computeRange(search: URLSearchParams): { from: string; to: string; daysInMonth: number } {
  // 1) Explicit from/to: coerce instead of fail
  const fromParam = search.get("from");
  const toParam = search.get("to");
  if (fromParam && toParam) {
    const fromFixed = coerceISODateUTC(fromParam);
    const toFixed = coerceISODateUTC(toParam);
    if (!fromFixed || !toFixed) throw new Error("invalid from/to");
    const fromDt = parseISODateUTC(fromFixed)!;
    const toDt = parseISODateUTC(toFixed)!;
    if (toDt < fromDt) throw new Error("to must be >= from");
    const last = new Date(Date.UTC(fromDt.getUTCFullYear(), fromDt.getUTCMonth() + 1, 0)).getUTCDate();
    return { from: fromFixed, to: toFixed, daysInMonth: last };
  }

  // 2) ym=YYYY-MM
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
    m = now.getUTCMonth() + 1;
  } else {
    const n = Number(mRaw);
    if (!Number.isFinite(n)) throw new Error("invalid month");
    if (n >= 1 && n <= 12) m = n;
    else if (n >= 0 && n <= 11) m = n + 1;
    else throw new Error("invalid month");
  }
  return monthBounds(y, m);
}
