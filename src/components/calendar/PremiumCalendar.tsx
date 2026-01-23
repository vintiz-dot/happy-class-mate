import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Clock, 
  Users,
  List,
  Grid3X3,
  CalendarDays,
  GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayjs, nowBangkok } from "@/lib/date";
import { getSessionDisplayStatus, type SessionStatus } from "@/lib/sessionStatus";
import MiniCalendar from "./MiniCalendar";
import AgendaView from "./AgendaView";

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
  onRescheduleEvent?: (eventId: string, newDate: string) => void;
  isAdmin?: boolean;
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

// Draggable Event Card Component
function EventCard({ 
  event, 
  onSelect,
  index,
  isDraggable,
  onDragStart,
}: { 
  event: CalendarEvent; 
  onSelect?: (event: CalendarEvent) => void;
  index: number;
  isDraggable?: boolean;
  onDragStart?: (event: CalendarEvent) => void;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  const handleNativeDragStart = (e: React.DragEvent) => {
    if (isDraggable && onDragStart) {
      e.dataTransfer.setData("text/plain", event.id);
      e.dataTransfer.effectAllowed = "move";
      onDragStart(event);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      draggable={isDraggable}
      onDragStart={handleNativeDragStart as any}
      onClick={() => onSelect?.(event)}
      className={cn(
        "w-full text-left px-2.5 py-2 rounded-xl border transition-all duration-300",
        "backdrop-blur-sm cursor-pointer group",
        "hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        config.bg,
        config.border,
        `hover:${config.glow}`,
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {isDraggable && (
              <GripVertical className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            )}
            <div className={cn(
              "font-semibold text-xs truncate transition-colors",
              config.text,
              "group-hover:opacity-100"
            )}>
              {event.class_name}
            </div>
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
    </motion.div>
  );
}

// Day Cell Component with drop zone
function DayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  onSelectDay,
  onSelectEvent,
  isAdmin,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
}: {
  date: dayjs.Dayjs;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onSelectDay?: (date: string) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  isAdmin?: boolean;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (event: CalendarEvent) => void;
}) {
  const dateStr = date.format("YYYY-MM-DD");
  const hasEvents = events.length > 0;
  const isWeekend = date.day() === 0 || date.day() === 6;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "min-h-[120px] md:min-h-[140px] p-2 rounded-2xl border transition-all duration-300",
        "relative overflow-hidden group",
        isCurrentMonth 
          ? "bg-card/50 dark:bg-card/30 border-border/50" 
          : "bg-muted/20 dark:bg-muted/10 border-transparent opacity-50",
        isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        hasEvents && isCurrentMonth && "hover:shadow-xl hover:border-primary/30 hover:bg-card/80",
        isWeekend && isCurrentMonth && "bg-muted/30 dark:bg-muted/20",
        isDragOver && "ring-2 ring-primary ring-dashed bg-primary/5 border-primary/50"
      )}
    >
      {/* Drag over indicator */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/10 rounded-2xl flex items-center justify-center pointer-events-none z-10"
          >
            <span className="text-xs font-medium text-primary">Drop here</span>
          </motion.div>
        )}
      </AnimatePresence>

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
              isDraggable={isAdmin}
              onDragStart={onDragStart}
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

// View toggle component
function ViewToggle({ 
  view, 
  onViewChange 
}: { 
  view: "grid" | "agenda"; 
  onViewChange: (view: "grid" | "agenda") => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("grid")}
        className={cn(
          "h-8 px-3 rounded-lg transition-all",
          view === "grid" && "shadow-md"
        )}
      >
        <Grid3X3 className="h-4 w-4 mr-1.5" />
        Grid
      </Button>
      <Button
        variant={view === "agenda" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("agenda")}
        className={cn(
          "h-8 px-3 rounded-lg transition-all",
          view === "agenda" && "shadow-md"
        )}
      >
        <List className="h-4 w-4 mr-1.5" />
        Agenda
      </Button>
    </div>
  );
}

// Main Premium Calendar Component
export default function PremiumCalendar({
  events,
  onSelectDay,
  onSelectEvent,
  onRescheduleEvent,
  isAdmin = false,
  className,
}: PremiumCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => dayjs());
  const [view, setView] = useState<"grid" | "agenda">("grid");
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);

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

  // Event dates set for mini calendar
  const eventDatesSet = useMemo(() => new Set(events.map(e => e.date)), [events]);

  // Stats for the header
  const monthStats = useMemo(() => {
    const monthStart = currentMonth.startOf("month").format("YYYY-MM-DD");
    const monthEnd = currentMonth.endOf("month").format("YYYY-MM-DD");
    
    const monthEvents = events.filter(e => e.date >= monthStart && e.date <= monthEnd);
    const totalSessions = monthEvents.length;
    const scheduledCount = monthEvents.filter(e => getEventStatusKey(e) === "scheduled" || getEventStatusKey(e) === "today").length;
    
    return { totalSessions, scheduledCount };
  }, [events, currentMonth]);

  const goToToday = useCallback(() => setCurrentMonth(dayjs()), []);
  const goToPrevMonth = useCallback(() => setCurrentMonth(m => m.subtract(1, "month")), []);
  const goToNextMonth = useCallback(() => setCurrentMonth(m => m.add(1, "month")), []);

  const handleMiniCalendarSelect = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentMonth(dayjs(dateStr));
    onSelectDay?.(dateStr);
    setShowMiniCalendar(false);
  }, [onSelectDay]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    if (!isAdmin || !draggingEvent) return;
    e.preventDefault();
    setDragOverDate(dateStr);
  }, [isAdmin, draggingEvent]);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    
    if (!isAdmin || !draggingEvent) return;
    
    const eventId = e.dataTransfer?.getData("text/plain");
    if (eventId && draggingEvent.date !== dateStr) {
      onRescheduleEvent?.(eventId, dateStr);
    }
    
    setDraggingEvent(null);
  }, [isAdmin, draggingEvent, onRescheduleEvent]);

  const handleDragStart = useCallback((event: CalendarEvent) => {
    setDraggingEvent(event);
  }, []);

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

          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowMiniCalendar(!showMiniCalendar)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <motion.h2 
                key={currentMonth.format("YYYY-MM")}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl md:text-3xl font-bold tracking-tight"
              >
                {currentMonth.format("MMMM YYYY")}
              </motion.h2>
              <CalendarDays className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                showMiniCalendar && "rotate-180"
              )} />
            </motion.button>

            {/* Mini Calendar Dropdown */}
            <AnimatePresence>
              {showMiniCalendar && (
                <div className="absolute top-full left-0 mt-2 z-50">
                  <MiniCalendar
                    currentMonth={currentMonth}
                    selectedDate={selectedDate}
                    eventDates={eventDatesSet}
                    onSelectDate={handleMiniCalendarSelect}
                    onChangeMonth={setCurrentMonth}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle */}
          <ViewToggle view={view} onViewChange={setView} />

          {/* Stats Pills */}
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

      {/* Drag hint for admin */}
      {isAdmin && view === "grid" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs text-muted-foreground px-4"
        >
          <GripVertical className="h-3 w-3" />
          <span>Drag and drop sessions to reschedule</span>
        </motion.div>
      )}

      {/* Calendar Content */}
      <AnimatePresence mode="wait">
        {view === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="glass rounded-3xl p-4 md:p-6"
          >
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
                    isAdmin={isAdmin}
                    isDragOver={dragOverDate === dateStr}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dateStr)}
                    onDragStart={handleDragStart}
                  />
                );
              })}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="agenda"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <AgendaView
              events={events}
              currentMonth={currentMonth}
              onSelectEvent={onSelectEvent!}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
