import { useMemo } from "react";
import { buildMonthGrid, todayKey, dayjs } from "@/lib/date";

type CalendarEvent = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  status: "Scheduled" | "Held" | "Canceled" | "Holiday";
  enrolled_count?: number;
  notes?: string;
};

interface CalendarMonthProps {
  month: string;
  events: CalendarEvent[];
  onSelectDay?: (date: string) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}

export default function CalendarMonth({
  month,
  events,
  onSelectDay,
  onSelectEvent,
}: CalendarMonthProps) {
  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const byDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      (map[e.date] ||= []).push(e);
    }
    for (const k in map) {
      map[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [events]);

  const isToday = (d: string) => d === todayKey();
  const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const statusClass = (s: CalendarEvent["status"], d: string, isPast: boolean) => {
    const baseClasses = "transition-colors";
    
    // Canceled and Holiday have fixed colors
    if (s === "Canceled") return `${baseClasses} bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100`;
    if (s === "Holiday") return `${baseClasses} bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100`;
    
    // Today gets special highlight
    if (d === todayKey()) {
      if (s === "Held") return `${baseClasses} bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100`;
      return `${baseClasses} bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100`;
    }
    
    // Past dates
    if (isPast) {
      if (s === "Held") return `${baseClasses} bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100`;
      // Past scheduled (should have been held) - show as scheduled
      return `${baseClasses} bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100`;
    }
    
    // Future dates - always muted
    return `${baseClasses} bg-muted text-muted-foreground`;
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
        {weekdayHeaders.map((h) => (
          <div key={h} className="px-2 py-1 text-center font-medium">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d) => (
          <div
            key={d}
            className={`border rounded-lg p-2 min-h-[100px] ${
              isToday(d) ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                {dayjs.tz(d).format("ddd")}
              </div>
              <button
                className="text-sm font-medium hover:text-primary"
                onClick={() => onSelectDay?.(d)}
              >
                {dayjs.tz(d).format("D")}
              </button>
            </div>
            <div className="space-y-1">
              {(byDate[d] || []).map((ev) => {
                const isPast = dayjs.tz(d).isBefore(dayjs(), "day");
                
                return (
                  <button
                    key={ev.id}
                    title={`${ev.class_name} ${ev.start_time}-${ev.end_time}${
                      ev.notes ? `\n${ev.notes}` : ""
                    }`}
                    className={`w-full text-left px-2 py-1 rounded text-xs ${statusClass(
                      ev.status,
                      d,
                      isPast
                    )} hover:opacity-80 transition-opacity`}
                    onClick={() => onSelectEvent?.(ev)}
                  >
                    <div className="font-medium truncate">{ev.class_name}</div>
                    <div className="text-[10px] opacity-90">
                      {ev.start_time.slice(0, 5)}-{ev.end_time.slice(0, 5)}
                    </div>
                    {ev.enrolled_count ? (
                      <div className="text-[10px] opacity-75">
                        {ev.enrolled_count} students
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100">
          Scheduled
        </span>
        <span className="px-2 py-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
          Today
        </span>
        <span className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          Held
        </span>
        <span className="px-2 py-1 rounded bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100">
          Canceled
        </span>
        <span className="px-2 py-1 rounded bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100">
          Holiday
        </span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
          Future
        </span>
      </div>
    </div>
  );
}
