import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monthKey, dayjs } from "@/lib/date";
import CalendarMonth from "@/components/calendar/CalendarMonth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Dashboard() {
  const [month, setMonth] = useState(monthKey());

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", month],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("calendar-events", {
        body: { month },
      });
      if (error) throw error;
      return data?.events || [];
    },
  });

  const prevMonth = () => {
    setMonth(dayjs.tz(`${month}-01`).subtract(1, "month").format("YYYY-MM"));
  };

  const nextMonth = () => {
    setMonth(dayjs.tz(`${month}-01`).add(1, "month").format("YYYY-MM"));
  };

  const goToday = () => {
    setMonth(monthKey());
  };

  return (
    <Layout title="Dashboard">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-semibold min-w-[200px] text-center">
            {dayjs.tz(`${month}-01`).format("MMMM YYYY")}
          </div>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToday} className="ml-2">
            Today
          </Button>
        </div>

        <CalendarMonth month={month} events={events} />
      </div>
    </Layout>
  );
}
