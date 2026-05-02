import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dayjs } from "@/lib/date";

/**
 * Returns the earliest month (YYYY-MM) for which any finance data exists,
 * looking across payments, expenditures, and ledger entries.
 * Falls back to 12 months ago if nothing is found.
 */
export function useEarliestFinanceMonth() {
  return useQuery({
    queryKey: ["earliest-finance-month"],
    staleTime: 1000 * 60 * 60, // 1h
    queryFn: async (): Promise<string> => {
      const fallback = dayjs().subtract(11, "month").format("YYYY-MM");

      const [paymentsRes, expRes, ledgerRes] = await Promise.all([
        supabase
          .from("payments")
          .select("occurred_at")
          .order("occurred_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("expenditures")
          .select("date")
          .order("date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("ledger_entries")
          .select("month")
          .not("month", "is", null)
          .order("month", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const candidates: string[] = [];
      if (paymentsRes.data?.occurred_at) {
        candidates.push(dayjs(paymentsRes.data.occurred_at as string).format("YYYY-MM"));
      }
      if (expRes.data?.date) {
        candidates.push(dayjs(expRes.data.date as string).format("YYYY-MM"));
      }
      if (ledgerRes.data?.month) {
        candidates.push(ledgerRes.data.month as string);
      }

      if (candidates.length === 0) return fallback;
      return candidates.sort()[0];
    },
  });
}
