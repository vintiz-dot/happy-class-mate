import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildMonthGrid, todayKey, dayjs, nowBangkok } from "@/lib/date";
import { getSessionDisplayStatus, getStatusColorClass } from "@/lib/sessionStatus";
import { cn } from "@/lib/utils";
import { Clock, Users } from "lucide-react";

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

// Status configuration with premium styling
const statusConfig: Record<string, { 
  bg: string; 
  border: string; 
  text: string;
  icon: string;
}> = {
  scheduled: {
    bg: "bg-success/10 dark:bg-success/20",
    border: "border-success/30 dark:border-success/40",
    text: "text-success dark:text-success",
    icon: "✨"
  },
  today: {
    bg: "bg-primary/10 dark:bg-primary/20",
    border: "border-primary/40 dark:border-primary/50",
    text: "text-primary dark:text-primary",
    icon: "🌟"
  },
  needsAttention: {
    bg: "bg-warning/10 dark:bg-warning/20",
    border: "border-warning/40 dark:border-warning/50",
    text: "text-warning dark:text-warning",
    icon: "⚡"
  },
  held: {
    bg: "bg-muted/60 dark:bg-muted/40",
    border: "border-muted-foreground/20",
    text: "text-muted-foreground",
    icon: "✓"
  },
  canceled: {
    bg: "bg-destructive/10 dark:bg-destructive/20",
    border: "border-destructive/30 dark:border-destructive/40",
    text: "text-destructive dark:text-destructive",
    icon: "✕"
  },
  holiday: {
    bg: "bg-accent/10 dark:bg-accent/20",
    border: "border-accent/30 dark:border-accent/40",
    text: "text-accent dark:text-accent",
    icon: "🎉"
  },
};

function getEventStatusKey(event: CalendarEvent): string {
  const displayStatus = getSessionDisplayStatus({
    date: event.date,
    start_time: event.start_time,
    status: event.status,
  });

  const sessionDateTime = new Date(`${event.date}T${event.start_time}`);
  const now = nowBangkok().toDate();
  const isPast = sessionDateTime < now;
  const isToday = dayjs(event.date).isSame(dayjs(), "day");

  if (displayStatus === "Canceled") return "canceled";
  if (displayStatus === "Holiday") return "holiday";
  if (displayStatus === "Held") return "held";
  if (isToday && displayStatus === "Scheduled") return "today";
  if (isPast && displayStatus === "Scheduled") return "needsAttention";
  return "scheduled";
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

  return (
    <div className="space-y-4">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-2">
        {weekdayHeaders.map((day, idx) => (
          <div 
            key={day} 
            className={cn(
              "text-center py-3 text-sm font-semibold rounded-xl",
              idx >= 5 
                ? "text-muted-foreground/70 bg-muted/30" 
                : "text-muted-foreground"
            )}
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-7 gap-2"
      >
        {cells.map((d) => {
          const dayEvents = byDate[d] || [];
          const isTodayCell = isToday(d);
          const hasEvents = dayEvents.length > 0;
          const dayDate = dayjs.tz(d, 'Asia/Bangkok');
          const isWeekend = dayDate.day() === 0 || dayDate.day() === 6;

          return (
            <motion.div
              key={d}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "min-h-[120px] md:min-h-[140px] p-2 rounded-2xl border transition-all duration-300",
                "relative overflow-hidden group",
                "bg-card/50 dark:bg-card/30 border-border/50",
                isTodayCell && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                hasEvents && "hover:shadow-xl hover:border-primary/30 hover:bg-card/80",
                isWeekend && "bg-muted/30 dark:bg-muted/20"
              )}
            >
              {/* Subtle gradient overlay for today */}
              {isTodayCell && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
              )}

              {/* Date header */}
              <div className="flex items-center justify-between mb-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectDay?.(d)}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-xl text-sm font-semibold transition-all",
                    isTodayCell 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {dayDate.format("D")}
                </motion.button>
                {hasEvents && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-primary/10 text-primary"
                  >
                    {dayEvents.length}
                  </motion.div>
                )}
              </div>

              {/* Events list */}
              <div className="space-y-1.5 overflow-y-auto max-h-[80px] md:max-h-[100px] scrollbar-hide">
                <AnimatePresence mode="popLayout">
                  {dayEvents.slice(0, 3).map((event, idx) => {
                    const statusKey = getEventStatusKey(event);
                    const config = statusConfig[statusKey];

                    return (
                      <motion.button
                        key={event.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectEvent?.(event)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-xl border transition-all duration-300",
                          "backdrop-blur-sm cursor-pointer group/event",
                          "hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                          config.bg,
                          config.border
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "font-semibold text-xs truncate transition-colors",
                              config.text
                            )}>
                              {event.class_name}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                              <span className="text-[10px] text-muted-foreground/80">
                                {event.start_time.slice(0, 5)}
                              </span>
                            </div>
                          </div>
                          <motion.span 
                            className="text-xs opacity-60 group-hover/event:opacity-100 transition-opacity"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {config.icon}
                          </motion.span>
                        </div>
                        {event.enrolled_count ? (
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="h-2.5 w-2.5 text-muted-foreground/50" />
                            <span className="text-[9px] text-muted-foreground/60">
                              {event.enrolled_count}
                            </span>
                          </div>
                        ) : null}
                      </motion.button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-muted-foreground text-center py-1"
                    >
                      +{dayEvents.length - 3} more
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Legend */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center justify-center gap-3 px-4"
      >
        {Object.entries(statusConfig).map(([key, config]) => (
          <motion.div
            key={key}
            whileHover={{ scale: 1.05 }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium",
              "border transition-all cursor-default",
              config.bg,
              config.border,
              config.text
            )}
          >
            <span>{config.icon}</span>
            <span className="capitalize">{key === "needsAttention" ? "Needs Attendance" : key}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
