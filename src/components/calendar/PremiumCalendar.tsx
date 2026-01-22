import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayjs, nowBangkok } from "@/lib/date";
import { getSessionDisplayStatus, type SessionStatus } from "@/lib/sessionStatus";

// Types
export interface CalendarEvent {
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

interface PremiumCalendarProps {
  events: CalendarEvent[];
  onSelectDay?: (date: string) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  className?: string;
}

// Status configuration with premium styling
const statusConfig: Record<string, { 
  bg: string; 
  border: string; 
  text: string; 
  glow: string;
  icon: string;
  label: string;
}> = {
  scheduled: {
    bg: "bg-success/10 dark:bg-success/20",
    border: "border-success/30 dark:border-success/40",
    text: "text-success dark:text-success",
    glow: "shadow-success/20",
    icon: "✨",
    label: "Scheduled"
  },
  today: {
    bg: "bg-primary/10 dark:bg-primary/20",
    border: "border-primary/40 dark:border-primary/50",
    text: "text-primary dark:text-primary",
    glow: "shadow-primary/30",
    icon: "🌟",
    label: "Today"
  },
  needsAttention: {
    bg: "bg-warning/10 dark:bg-warning/20",
    border: "border-warning/40 dark:border-warning/50",
    text: "text-warning dark:text-warning",
    glow: "shadow-warning/20",
    icon: "⚡",
    label: "Needs Attendance"
  },
  held: {
    bg: "bg-muted/60 dark:bg-muted/40",
    border: "border-muted-foreground/20",
    text: "text-muted-foreground",
    glow: "shadow-none",
    icon: "✓",
    label: "Held"
  },
  canceled: {
    bg: "bg-destructive/10 dark:bg-destructive/20",
    border: "border-destructive/30 dark:border-destructive/40",
    text: "text-destructive dark:text-destructive",
    glow: "shadow-destructive/20",
    icon: "✕",
    label: "Canceled"
  },
  holiday: {
    bg: "bg-accent/10 dark:bg-accent/20",
    border: "border-accent/30 dark:border-accent/40",
    text: "text-accent dark:text-accent",
    glow: "shadow-accent/20",
    icon: "🎉",
    label: "Holiday"
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

// Premium Event Card Component
function EventCard({ 
  event, 
  onSelect,
  index 
}: { 
  event: CalendarEvent; 
  onSelect?: (event: CalendarEvent) => void;
  index: number;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect?.(event)}
      className={cn(
        "w-full text-left px-2.5 py-2 rounded-xl border transition-all duration-300",
        "backdrop-blur-sm cursor-pointer group",
        "hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        config.bg,
        config.border,
        `hover:${config.glow}`
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-semibold text-xs truncate transition-colors",
            config.text,
            "group-hover:opacity-100"
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
          className="text-xs opacity-60 group-hover:opacity-100 transition-opacity"
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
}

// Day Cell Component
function DayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  onSelectDay,
  onSelectEvent,
}: {
  date: dayjs.Dayjs;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onSelectDay?: (date: string) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  const dateStr = date.format("YYYY-MM-DD");
  const hasEvents = events.length > 0;
  const isWeekend = date.day() === 0 || date.day() === 6;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "min-h-[120px] md:min-h-[140px] p-2 rounded-2xl border transition-all duration-300",
        "relative overflow-hidden group",
        isCurrentMonth 
          ? "bg-card/50 dark:bg-card/30 border-border/50" 
          : "bg-muted/20 dark:bg-muted/10 border-transparent opacity-50",
        isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        hasEvents && isCurrentMonth && "hover:shadow-xl hover:border-primary/30 hover:bg-card/80",
        isWeekend && isCurrentMonth && "bg-muted/30 dark:bg-muted/20"
      )}
    >
      {/* Subtle gradient overlay for today */}
      {isToday && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      )}

      {/* Date header */}
      <div className="flex items-center justify-between mb-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectDay?.(dateStr)}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-xl text-sm font-semibold transition-all",
            isToday 
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
              : isCurrentMonth
                ? "hover:bg-muted text-foreground"
                : "text-muted-foreground",
          )}
        >
          {date.format("D")}
        </motion.button>
        {hasEvents && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
              "bg-primary/10 text-primary"
            )}
          >
            {events.length}
          </motion.div>
        )}
      </div>

      {/* Events list */}
      <div className="space-y-1.5 overflow-y-auto max-h-[80px] md:max-h-[100px] scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {events.slice(0, 3).map((event, idx) => (
            <EventCard 
              key={event.id} 
              event={event} 
              onSelect={onSelectEvent}
              index={idx}
            />
          ))}
          {events.length > 3 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-muted-foreground text-center py-1"
            >
              +{events.length - 3} more
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Main Premium Calendar Component
export default function PremiumCalendar({
  events,
  onSelectDay,
  onSelectEvent,
  className,
}: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => dayjs());

  // Build month grid
  const { cells, weekdays } = useMemo(() => {
    const start = currentMonth.startOf("month").startOf("isoWeek");
    const end = currentMonth.endOf("month").endOf("isoWeek");
    const cells: dayjs.Dayjs[] = [];
    let current = start;
    
    while (current.isBefore(end) || current.isSame(end, "day")) {
      cells.push(current);
      current = current.add(1, "day");
    }

    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return { cells, weekdays };
  }, [currentMonth]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      (map[event.date] ||= []).push(event);
    }
    // Sort by time
    for (const key in map) {
      map[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [events]);

  // Stats for the header
  const monthStats = useMemo(() => {
    const monthStart = currentMonth.startOf("month").format("YYYY-MM-DD");
    const monthEnd = currentMonth.endOf("month").format("YYYY-MM-DD");
    
    const monthEvents = events.filter(e => e.date >= monthStart && e.date <= monthEnd);
    const totalSessions = monthEvents.length;
    const scheduledCount = monthEvents.filter(e => getEventStatusKey(e) === "scheduled" || getEventStatusKey(e) === "today").length;
    const heldCount = monthEvents.filter(e => getEventStatusKey(e) === "held").length;
    
    return { totalSessions, scheduledCount, heldCount };
  }, [events, currentMonth]);

  const goToToday = useCallback(() => setCurrentMonth(dayjs()), []);
  const goToPrevMonth = useCallback(() => setCurrentMonth(m => m.subtract(1, "month")), []);
  const goToNextMonth = useCallback(() => setCurrentMonth(m => m.add(1, "month")), []);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <motion.div 
            className="flex items-center gap-1 bg-muted/50 rounded-2xl p-1"
            whileHover={{ scale: 1.01 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevMonth}
              className="h-10 w-10 rounded-xl hover:bg-background/80"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              onClick={goToToday}
              className="h-10 px-4 rounded-xl hover:bg-background/80 font-medium"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              className="h-10 w-10 rounded-xl hover:bg-background/80"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </motion.div>

          <motion.h2 
            key={currentMonth.format("YYYY-MM")}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl md:text-3xl font-bold tracking-tight"
          >
            {currentMonth.format("MMMM YYYY")}
          </motion.h2>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <motion.div 
            whileHover={{ scale: 1.02, y: -1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl glass-sm"
          >
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{monthStats.totalSessions}</span>
            <span className="text-xs text-muted-foreground">sessions</span>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.02, y: -1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl glass-sm"
          >
            <Sparkles className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold">{monthStats.scheduledCount}</span>
            <span className="text-xs text-muted-foreground">upcoming</span>
          </motion.div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass rounded-3xl p-4 md:p-6">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {weekdays.map((day, idx) => (
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
          key={currentMonth.format("YYYY-MM")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-7 gap-2"
        >
          {cells.map((date) => {
            const dateStr = date.format("YYYY-MM-DD");
            const dayEvents = eventsByDate[dateStr] || [];
            const isCurrentMonth = date.isSame(currentMonth, "month");
            const isToday = date.isSame(dayjs(), "day");

            return (
              <DayCell
                key={dateStr}
                date={date}
                events={dayEvents}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                onSelectDay={onSelectDay}
                onSelectEvent={onSelectEvent}
              />
            );
          })}
        </motion.div>
      </div>

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
            <span>{config.label}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
