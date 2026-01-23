import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayjs, nowBangkok } from "@/lib/date";
import { getSessionDisplayStatus, type SessionStatus } from "@/lib/sessionStatus";

export interface DayEvent {
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

interface CalendarDayViewProps {
  events: DayEvent[];
  currentDate: dayjs.Dayjs;
  onSelectEvent: (event: DayEvent) => void;
  onDayChange: (date: dayjs.Dayjs) => void;
  className?: string;
}

const statusConfig: Record<string, { 
  bg: string; 
  border: string; 
  text: string;
  gradient: string;
  icon: string;
}> = {
  scheduled: {
    bg: "bg-success/10",
    border: "border-success/30",
    text: "text-success",
    gradient: "from-success/20 to-success/5",
    icon: "✨"
  },
  today: {
    bg: "bg-primary/10",
    border: "border-primary/40",
    text: "text-primary",
    gradient: "from-primary/20 to-primary/5",
    icon: "🌟"
  },
  needsAttention: {
    bg: "bg-warning/10",
    border: "border-warning/40",
    text: "text-warning",
    gradient: "from-warning/20 to-warning/5",
    icon: "⚡"
  },
  held: {
    bg: "bg-muted/60",
    border: "border-muted-foreground/20",
    text: "text-muted-foreground",
    gradient: "from-muted/40 to-muted/10",
    icon: "✓"
  },
  canceled: {
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    text: "text-destructive",
    gradient: "from-destructive/20 to-destructive/5",
    icon: "✕"
  },
  holiday: {
    bg: "bg-accent/10",
    border: "border-accent/30",
    text: "text-accent",
    gradient: "from-accent/20 to-accent/5",
    icon: "🎉"
  },
};

function getEventStatusKey(event: DayEvent): string {
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

// Timeline event component
function TimelineEvent({
  event,
  onSelect,
  index,
}: {
  event: DayEvent;
  onSelect: (event: DayEvent) => void;
  index: number;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  // Calculate duration for visual height
  const startMinutes = parseInt(event.start_time.split(":")[0]) * 60 + parseInt(event.start_time.split(":")[1]);
  const endMinutes = parseInt(event.end_time.split(":")[0]) * 60 + parseInt(event.end_time.split(":")[1]);
  const duration = endMinutes - startMinutes;

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(event)}
      className={cn(
        "w-full text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden",
        "backdrop-blur-sm cursor-pointer group",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        config.border
      )}
      style={{ minHeight: Math.max(80, duration * 0.8) }}
    >
      {/* Gradient background */}
      <div className={cn("absolute inset-0 bg-gradient-to-r", config.gradient)} />
      
      <div className="relative p-4 md:p-5 flex gap-4">
        {/* Time column */}
        <div className="flex flex-col items-center min-w-[70px] md:min-w-[80px]">
          <span className={cn("text-lg md:text-xl font-bold", config.text)}>
            {event.start_time.slice(0, 5)}
          </span>
          <div className="h-4 w-px bg-border/50 my-1" />
          <span className="text-sm text-muted-foreground">
            {event.end_time.slice(0, 5)}
          </span>
          <span className="text-xs text-muted-foreground/60 mt-1">
            {duration} min
          </span>
        </div>

        {/* Divider line */}
        <div className="w-px bg-border/30 self-stretch" />

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={cn("font-bold text-base md:text-lg", config.text)}>
                {event.class_name}
              </h4>
              {event.teacher_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  {event.teacher_name}
                </p>
              )}
            </div>
            <motion.span 
              className="text-xl opacity-60 group-hover:opacity-100 transition-opacity"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {config.icon}
            </motion.span>
          </div>

          <div className="flex items-center gap-4 mt-3">
            {event.enrolled_count !== undefined && event.enrolled_count > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {event.enrolled_count} students
              </span>
            )}
            {event.notes && (
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                {event.notes}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// Mobile compact event card
function MobileEventCard({
  event,
  onSelect,
}: {
  event: DayEvent;
  onSelect: (event: DayEvent) => void;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(event)}
      className={cn(
        "w-full text-left p-4 rounded-xl border-l-4 transition-all",
        "bg-card/50 hover:bg-card/80",
        config.border.replace("border-2", "")
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full",
            config.bg.replace("/10", "")
          )} />
          <div>
            <div className={cn("font-semibold text-sm", config.text)}>
              {event.class_name}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}
            </div>
          </div>
        </div>
        <span className="text-base">{config.icon}</span>
      </div>
      {event.enrolled_count ? (
        <div className="flex items-center gap-1 mt-2 ml-5 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {event.enrolled_count} students
        </div>
      ) : null}
    </motion.button>
  );
}

export default function CalendarDayView({
  events,
  currentDate,
  onSelectEvent,
  onDayChange,
  className,
}: CalendarDayViewProps) {
  // Filter events for current day and sort by time
  const dayEvents = useMemo(() => {
    const dateStr = currentDate.format("YYYY-MM-DD");
    return events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [events, currentDate]);

  const isToday = currentDate.isSame(dayjs(), "day");

  const goToPrevDay = () => onDayChange(currentDate.subtract(1, "day"));
  const goToNextDay = () => onDayChange(currentDate.add(1, "day"));
  const goToToday = () => onDayChange(dayjs());

  return (
    <div className={cn("space-y-4", className)}>
      {/* Day Navigation */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevDay} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextDay} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 md:p-6"
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center font-bold",
              isToday
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span className="text-2xl md:text-3xl">{currentDate.format("D")}</span>
            <span className="text-xs opacity-80">{currentDate.format("ddd")}</span>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              {currentDate.format("dddd")}
              {isToday && (
                <span className="ml-2 text-sm font-normal text-primary">Today</span>
              )}
            </h2>
            <p className="text-muted-foreground">
              {currentDate.format("MMMM YYYY")}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {dayEvents.length} session{dayEvents.length !== 1 ? "s" : ""} scheduled
            </p>
          </div>
        </div>
      </motion.div>

      {/* Events Timeline - Desktop */}
      <div className="hidden md:block glass rounded-3xl p-6">
        {dayEvents.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {dayEvents.map((event, idx) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  onSelect={onSelectEvent}
                  index={idx}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <CalendarIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">
              No sessions scheduled
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Enjoy your free day!
            </p>
          </motion.div>
        )}
      </div>

      {/* Events List - Mobile (Google Calendar style) */}
      <div className="md:hidden space-y-2">
        {dayEvents.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {dayEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <MobileEventCard event={event} onSelect={onSelectEvent} />
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="glass rounded-2xl p-8 text-center">
            <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No sessions today</p>
          </div>
        )}
      </div>
    </div>
  );
}
