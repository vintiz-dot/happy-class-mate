import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayjs, nowBangkok } from "@/lib/date";
import { getSessionDisplayStatus, type SessionStatus } from "@/lib/sessionStatus";

export interface WeekEvent {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  status: SessionStatus;
  enrolled_count?: number;
  notes?: string;
  teacher_name?: string;
}

interface CalendarWeekViewProps {
  events: WeekEvent[];
  currentDate: dayjs.Dayjs;
  onSelectEvent: (event: WeekEvent) => void;
  onWeekChange: (date: dayjs.Dayjs) => void;
  onSelectDay?: (date: string) => void;
  className?: string;
}

const statusConfig: Record<string, { 
  bg: string; 
  border: string; 
  text: string;
  dotColor: string;
  icon: string;
}> = {
  scheduled: {
    bg: "bg-success/10 hover:bg-success/15",
    border: "border-l-4 border-l-success",
    text: "text-success",
    dotColor: "bg-success",
    icon: "✨"
  },
  today: {
    bg: "bg-primary/10 hover:bg-primary/15",
    border: "border-l-4 border-l-primary",
    text: "text-primary",
    dotColor: "bg-primary",
    icon: "🌟"
  },
  needsAttention: {
    bg: "bg-warning/10 hover:bg-warning/15",
    border: "border-l-4 border-l-warning",
    text: "text-warning",
    dotColor: "bg-warning",
    icon: "⚡"
  },
  held: {
    bg: "bg-muted/60 hover:bg-muted/80",
    border: "border-l-4 border-l-muted-foreground/30",
    text: "text-muted-foreground",
    dotColor: "bg-muted-foreground/50",
    icon: "✓"
  },
  canceled: {
    bg: "bg-destructive/10 hover:bg-destructive/15",
    border: "border-l-4 border-l-destructive",
    text: "text-destructive",
    dotColor: "bg-destructive",
    icon: "✕"
  },
  holiday: {
    bg: "bg-accent/10 hover:bg-accent/15",
    border: "border-l-4 border-l-accent",
    text: "text-accent",
    dotColor: "bg-accent",
    icon: "🎉"
  },
};

function getEventStatusKey(event: WeekEvent): string {
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

// Mobile event chip (Google Calendar style)
function MobileEventChip({
  event,
  onSelect,
}: {
  event: WeekEvent;
  onSelect: (event: WeekEvent) => void;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(event)}
      className={cn(
        "w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all",
        config.bg,
        config.border
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]">{config.icon}</span>
        <span className={cn("font-medium truncate flex-1", config.text)}>
          {event.class_name}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {event.start_time.slice(0, 5)}
      </div>
    </motion.button>
  );
}

// Desktop event card
function WeekEventCard({
  event,
  onSelect,
  index,
}: {
  event: WeekEvent;
  onSelect: (event: WeekEvent) => void;
  index: number;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(event)}
      className={cn(
        "w-full text-left p-3 rounded-xl transition-all duration-200",
        "backdrop-blur-sm cursor-pointer group",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn("font-semibold text-sm truncate", config.text)}>
            {event.class_name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">
              {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}
            </span>
          </div>
          {event.teacher_name && (
            <div className="text-xs text-muted-foreground/70 mt-1 truncate">
              {event.teacher_name}
            </div>
          )}
        </div>
        <motion.span 
          className="text-sm opacity-60 group-hover:opacity-100 transition-opacity"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {config.icon}
        </motion.span>
      </div>
      {event.enrolled_count ? (
        <div className="flex items-center gap-1 mt-2">
          <Users className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/60">
            {event.enrolled_count} students
          </span>
        </div>
      ) : null}
    </motion.button>
  );
}

export default function CalendarWeekView({
  events,
  currentDate,
  onSelectEvent,
  onWeekChange,
  onSelectDay,
  className,
}: CalendarWeekViewProps) {
  // Get week days (Mon-Sun)
  const weekDays = useMemo(() => {
    const startOfWeek = currentDate.startOf("isoWeek");
    return Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, "day"));
  }, [currentDate]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, WeekEvent[]> = {};
    const weekStart = weekDays[0].format("YYYY-MM-DD");
    const weekEnd = weekDays[6].format("YYYY-MM-DD");
    
    for (const event of events) {
      if (event.date >= weekStart && event.date <= weekEnd) {
        (map[event.date] ||= []).push(event);
      }
    }
    // Sort by time
    for (const key in map) {
      map[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [events, weekDays]);

  const goToPrevWeek = () => onWeekChange(currentDate.subtract(1, "week"));
  const goToNextWeek = () => onWeekChange(currentDate.add(1, "week"));
  const goToThisWeek = () => onWeekChange(dayjs());

  return (
    <div className={cn("space-y-4", className)}>
      {/* Week Navigation */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToThisWeek} className="text-xs">
            This Week
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {weekDays[0].format("MMM D")} - {weekDays[6].format("MMM D, YYYY")}
        </span>
      </div>

      {/* Week Grid - Desktop */}
      <div className="hidden md:block glass rounded-3xl p-4">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dateStr = day.format("YYYY-MM-DD");
            const dayEvents = eventsByDate[dateStr] || [];
            const isToday = day.isSame(dayjs(), "day");
            const isWeekend = day.day() === 0 || day.day() === 6;

            return (
              <div key={dateStr} className="space-y-2">
                {/* Day Header */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectDay?.(dateStr)}
                  className={cn(
                    "w-full flex flex-col items-center py-3 rounded-xl transition-all",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : isWeekend
                      ? "bg-muted/50 hover:bg-muted"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-xs font-medium opacity-80">
                    {day.format("ddd")}
                  </span>
                  <span className="text-lg font-bold">{day.format("D")}</span>
                </motion.button>

                {/* Events */}
                <div className="space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto scrollbar-hide">
                  <AnimatePresence mode="popLayout">
                    {dayEvents.map((event, idx) => (
                      <WeekEventCard
                        key={event.id}
                        event={event}
                        onSelect={onSelectEvent}
                        index={idx}
                      />
                    ))}
                  </AnimatePresence>
                  {dayEvents.length === 0 && (
                    <div className="text-xs text-muted-foreground/40 text-center py-8">
                      No events
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Week Grid - Mobile (Google Calendar style) */}
      <div className="md:hidden glass rounded-2xl p-3">
        <div className="grid grid-cols-7 gap-1 mb-3">
          {weekDays.map((day) => {
            const isToday = day.isSame(dayjs(), "day");
            const dateStr = day.format("YYYY-MM-DD");
            const hasEvents = (eventsByDate[dateStr] || []).length > 0;

            return (
              <motion.button
                key={dateStr}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectDay?.(dateStr)}
                className={cn(
                  "flex flex-col items-center py-2 rounded-xl transition-all",
                  isToday
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="text-[10px] font-medium opacity-70">
                  {day.format("ddd").charAt(0)}
                </span>
                <span className="text-sm font-bold">{day.format("D")}</span>
                {hasEvents && !isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Mobile scrollable events list */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {weekDays.map((day) => {
            const dateStr = day.format("YYYY-MM-DD");
            const dayEvents = eventsByDate[dateStr] || [];
            const isToday = day.isSame(dayjs(), "day");

            if (dayEvents.length === 0) return null;

            return (
              <motion.div
                key={dateStr}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 sticky top-0 bg-background/90 backdrop-blur-sm py-1 z-10">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {day.format("D")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {day.format("dddd")}
                    {isToday && <span className="text-primary ml-1">• Today</span>}
                  </div>
                </div>
                <div className="space-y-1.5 pl-10">
                  {dayEvents.map((event) => (
                    <MobileEventChip
                      key={event.id}
                      event={event}
                      onSelect={onSelectEvent}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
          {Object.keys(eventsByDate).length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No events this week
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
