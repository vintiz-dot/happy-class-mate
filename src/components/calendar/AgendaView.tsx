import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayjs } from "@/lib/date";
import { getSessionDisplayStatus, type SessionStatus } from "@/lib/sessionStatus";
import { nowBangkok } from "@/lib/date";

export interface AgendaEvent {
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

interface AgendaViewProps {
  events: AgendaEvent[];
  currentMonth: dayjs.Dayjs;
  onSelectEvent: (event: AgendaEvent) => void;
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
    bg: "bg-success/5 hover:bg-success/10",
    border: "border-l-success",
    text: "text-success",
    dotColor: "bg-success",
    icon: "✨"
  },
  today: {
    bg: "bg-primary/5 hover:bg-primary/10",
    border: "border-l-primary",
    text: "text-primary",
    dotColor: "bg-primary",
    icon: "🌟"
  },
  needsAttention: {
    bg: "bg-warning/5 hover:bg-warning/10",
    border: "border-l-warning",
    text: "text-warning",
    dotColor: "bg-warning",
    icon: "⚡"
  },
  held: {
    bg: "bg-muted/50 hover:bg-muted/70",
    border: "border-l-muted-foreground/30",
    text: "text-muted-foreground",
    dotColor: "bg-muted-foreground/50",
    icon: "✓"
  },
  canceled: {
    bg: "bg-destructive/5 hover:bg-destructive/10",
    border: "border-l-destructive",
    text: "text-destructive",
    dotColor: "bg-destructive",
    icon: "✕"
  },
  holiday: {
    bg: "bg-accent/5 hover:bg-accent/10",
    border: "border-l-accent",
    text: "text-accent",
    dotColor: "bg-accent",
    icon: "🎉"
  },
};

function getEventStatusKey(event: AgendaEvent): string {
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

function AgendaEventCard({
  event,
  onSelect,
  index,
}: {
  event: AgendaEvent;
  onSelect: (event: AgendaEvent) => void;
  index: number;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(event)}
      className={cn(
        "w-full text-left p-4 rounded-xl border-l-4 transition-all duration-300",
        "backdrop-blur-sm cursor-pointer group flex items-start gap-4",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        config.bg,
        config.border
      )}
    >
      {/* Time column */}
      <div className="flex flex-col items-center min-w-[60px]">
        <span className="text-sm font-bold text-foreground">
          {event.start_time.slice(0, 5)}
        </span>
        <span className="text-[10px] text-muted-foreground">to</span>
        <span className="text-xs text-muted-foreground">
          {event.end_time.slice(0, 5)}
        </span>
      </div>

      {/* Divider */}
      <div className="flex flex-col items-center self-stretch">
        <motion.div
          className={cn("w-3 h-3 rounded-full", config.dotColor)}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="flex-1 w-px bg-border/50 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className={cn("font-semibold text-sm", config.text)}>
              {event.class_name}
            </h4>
            {event.teacher_name && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.teacher_name}
              </p>
            )}
          </div>
          <span className="text-lg opacity-60 group-hover:opacity-100 transition-opacity">
            {config.icon}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-2">
          {event.enrolled_count !== undefined && event.enrolled_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {event.enrolled_count} students
            </span>
          )}
          {event.notes && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {event.notes}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default function AgendaView({
  events,
  currentMonth,
  onSelectEvent,
  className,
}: AgendaViewProps) {
  // Group events by date
  const groupedEvents = useMemo(() => {
    const monthStart = currentMonth.startOf("month").format("YYYY-MM-DD");
    const monthEnd = currentMonth.endOf("month").format("YYYY-MM-DD");

    const filtered = events
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      });

    const groups: { date: string; events: AgendaEvent[] }[] = [];
    for (const event of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.date === event.date) {
        last.events.push(event);
      } else {
        groups.push({ date: event.date, events: [event] });
      }
    }

    return groups;
  }, [events, currentMonth]);

  if (groupedEvents.length === 0) {
    return (
      <div className={cn("glass rounded-3xl p-8", className)}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            No sessions this month
          </h3>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Sessions will appear here when scheduled
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("glass rounded-3xl p-4 md:p-6 space-y-6", className)}>
      <AnimatePresence mode="popLayout">
        {groupedEvents.map((group, groupIdx) => {
          const date = dayjs(group.date);
          const isToday = date.isSame(dayjs(), "day");

          return (
            <motion.div
              key={group.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: groupIdx * 0.05 }}
              className="space-y-3"
            >
              {/* Date header */}
              <div className="flex items-center gap-3 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-2xl font-bold text-lg",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {date.format("D")}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {date.format("dddd")}
                    {isToday && (
                      <span className="ml-2 text-xs font-normal text-primary">
                        Today
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {date.format("MMMM YYYY")} • {group.events.length} session
                    {group.events.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Events */}
              <div className="space-y-2 pl-4">
                {group.events.map((event, idx) => (
                  <AgendaEventCard
                    key={event.id}
                    event={event}
                    onSelect={onSelectEvent}
                    index={idx}
                  />
                ))}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
