import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  GripVertical,
  CalendarRange,
  CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayjs, nowBangkok } from "@/lib/date";
import { getSessionDisplayStatus, type SessionStatus } from "@/lib/sessionStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import MiniCalendar from "./MiniCalendar";
import AgendaView from "./AgendaView";
import CalendarWeekView from "./CalendarWeekView";
import CalendarDayView from "./CalendarDayView";

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

type CalendarViewType = "month" | "week" | "day" | "agenda";

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

// Mobile-optimized Event Card
function MobileEventCard({ 
  event, 
  onSelect,
}: { 
  event: CalendarEvent; 
  onSelect?: (event: CalendarEvent) => void;
}) {
  const statusKey = getEventStatusKey(event);
  const config = statusConfig[statusKey];

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect?.(event)}
      className={cn(
        "w-full text-left px-2 py-1 rounded-lg border transition-all",
        "backdrop-blur-sm cursor-pointer",
        config.bg,
        config.border
      )}
    >
      <div className="flex items-center gap-1">
        <span className="text-[8px]">{config.icon}</span>
        <span className={cn("text-[10px] font-medium truncate flex-1", config.text)}>
          {event.class_name}
        </span>
      </div>
      <div className="text-[8px] text-muted-foreground">
        {event.start_time.slice(0, 5)}
      </div>
    </motion.button>
  );
}

// Desktop Event Card Component
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
  isMobile,
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
  isMobile?: boolean;
}) {
  const dateStr = date.format("YYYY-MM-DD");
  const hasEvents = events.length > 0;
  const isWeekend = date.day() === 0 || date.day() === 6;

  // Mobile layout - compact with expandable events
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "min-h-[100px] p-1.5 rounded-xl border transition-all duration-200",
          "relative overflow-hidden",
          isCurrentMonth 
            ? "bg-card/50 border-border/30" 
            : "bg-muted/10 border-transparent opacity-40",
          isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          isWeekend && isCurrentMonth && "bg-muted/20"
        )}
      >
        {/* Date header */}
        <div className="flex items-center justify-between mb-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelectDay?.(dateStr)}
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold transition-all",
              isToday 
                ? "bg-primary text-primary-foreground" 
                : isCurrentMonth
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {date.format("D")}
          </motion.button>
          {hasEvents && events.length > 2 && (
            <span className="text-[8px] text-muted-foreground">
              +{events.length - 2}
            </span>
          )}
        </div>

        {/* Compact events - show max 2 */}
        <div className="space-y-1">
          {events.slice(0, 2).map((event) => (
            <MobileEventCard 
              key={event.id} 
              event={event} 
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  // Desktop layout
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

// View toggle component with all 4 options
function ViewToggle({ 
  view, 
  onViewChange,
  isMobile,
}: { 
  view: CalendarViewType; 
  onViewChange: (view: CalendarViewType) => void;
  isMobile?: boolean;
}) {
  const views: { key: CalendarViewType; label: string; icon: React.ReactNode; mobileLabel: string }[] = [
    { key: "month", label: "Month", icon: <Grid3X3 className="h-4 w-4" />, mobileLabel: "M" },
    { key: "week", label: "Week", icon: <CalendarRange className="h-4 w-4" />, mobileLabel: "W" },
    { key: "day", label: "Day", icon: <CalendarClock className="h-4 w-4" />, mobileLabel: "D" },
    { key: "agenda", label: "Agenda", icon: <List className="h-4 w-4" />, mobileLabel: "A" },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-1">
      {views.map(({ key, label, icon, mobileLabel }) => (
        <Button
          key={key}
          variant={view === key ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange(key)}
          className={cn(
            "h-8 rounded-lg transition-all",
            isMobile ? "px-2" : "px-3",
            view === key && "shadow-md"
          )}
        >
          {icon}
          {!isMobile && <span className="ml-1.5">{label}</span>}
          {isMobile && <span className="ml-1 text-xs">{mobileLabel}</span>}
        </Button>
      ))}
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
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(() => dayjs());
  const [view, setView] = useState<CalendarViewType>("month");
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);

  // Build month grid
  const { cells, weekdays } = useMemo(() => {
    const start = currentDate.startOf("month").startOf("isoWeek");
    const end = currentDate.endOf("month").endOf("isoWeek");
    const cells: dayjs.Dayjs[] = [];
    let current = start;
    
    while (current.isBefore(end) || current.isSame(end, "day")) {
      cells.push(current);
      current = current.add(1, "day");
    }

    const weekdays = isMobile 
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return { cells, weekdays };
  }, [currentDate, isMobile]);

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
    const monthStart = currentDate.startOf("month").format("YYYY-MM-DD");
    const monthEnd = currentDate.endOf("month").format("YYYY-MM-DD");
    
    const monthEvents = events.filter(e => e.date >= monthStart && e.date <= monthEnd);
    const totalSessions = monthEvents.length;
    const scheduledCount = monthEvents.filter(e => getEventStatusKey(e) === "scheduled" || getEventStatusKey(e) === "today").length;
    
    return { totalSessions, scheduledCount };
  }, [events, currentDate]);

  const goToToday = useCallback(() => setCurrentDate(dayjs()), []);
  const goToPrevMonth = useCallback(() => setCurrentDate(m => m.subtract(1, "month")), []);
  const goToNextMonth = useCallback(() => setCurrentDate(m => m.add(1, "month")), []);

  const handleMiniCalendarSelect = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentDate(dayjs(dateStr));
    onSelectDay?.(dateStr);
    setShowMiniCalendar(false);
  }, [onSelectDay]);

  const handleDaySelect = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentDate(dayjs(dateStr));
    setView("day");
    onSelectDay?.(dateStr);
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
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Premium Header */}
      <div className="flex flex-col gap-4">
        {/* Top row - Navigation and View Toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <motion.div 
              className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-1"
              whileHover={{ scale: 1.01 }}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevMonth}
                className="h-8 w-8 md:h-10 md:w-10 rounded-xl hover:bg-background/80"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={goToToday}
                className="h-8 md:h-10 px-2 md:px-4 rounded-xl hover:bg-background/80 font-medium text-xs md:text-sm"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                className="h-8 w-8 md:h-10 md:w-10 rounded-xl hover:bg-background/80"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </motion.div>

            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowMiniCalendar(!showMiniCalendar)}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <motion.h2 
                  key={currentDate.format("YYYY-MM")}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-lg md:text-2xl lg:text-3xl font-bold tracking-tight"
                >
                  {currentDate.format(isMobile ? "MMM YYYY" : "MMMM YYYY")}
                </motion.h2>
                <CalendarDays className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showMiniCalendar && "rotate-180"
                )} />
              </motion.button>

              {/* Mini Calendar Dropdown */}
              <AnimatePresence>
                {showMiniCalendar && (
                  <div className="absolute top-full left-0 mt-2 z-50">
                    <MiniCalendar
                      currentMonth={currentDate}
                      selectedDate={selectedDate}
                      eventDates={eventDatesSet}
                      onSelectDate={handleMiniCalendarSelect}
                      onChangeMonth={setCurrentDate}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* View Toggle */}
          <ViewToggle view={view} onViewChange={setView} isMobile={isMobile} />
        </div>

        {/* Stats Pills - Hidden on mobile for cleaner look */}
        {!isMobile && (
          <div className="flex items-center gap-3">
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
        )}
      </div>

      {/* Drag hint for admin - only show on month view */}
      {isAdmin && view === "month" && !isMobile && (
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
        {view === "month" && (
          <motion.div
            key="month"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "glass rounded-2xl md:rounded-3xl p-2 md:p-4 lg:p-6",
              isMobile && "pb-4"
            )}
          >
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 md:mb-4">
              {weekdays.map((day, idx) => (
                <div 
                  key={day + idx} 
                  className={cn(
                    "text-center py-2 md:py-3 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl",
                    idx >= 5 
                      ? "text-muted-foreground/70 bg-muted/30" 
                      : "text-muted-foreground"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <motion.div 
              key={currentDate.format("YYYY-MM")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-7 gap-1 md:gap-2"
            >
              {cells.map((date) => {
                const dateStr = date.format("YYYY-MM-DD");
                const dayEvents = eventsByDate[dateStr] || [];
                const isCurrentMonth = date.isSame(currentDate, "month");
                const isToday = date.isSame(dayjs(), "day");

                return (
                  <DayCell
                    key={dateStr}
                    date={date}
                    events={dayEvents}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                    onSelectDay={handleDaySelect}
                    onSelectEvent={onSelectEvent}
                    isAdmin={isAdmin && !isMobile}
                    isDragOver={dragOverDate === dateStr}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dateStr)}
                    onDragStart={handleDragStart}
                    isMobile={isMobile}
                  />
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {view === "week" && (
          <motion.div
            key="week"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <CalendarWeekView
              events={events}
              currentDate={currentDate}
              onSelectEvent={onSelectEvent!}
              onWeekChange={setCurrentDate}
              onSelectDay={handleDaySelect}
            />
          </motion.div>
        )}

        {view === "day" && (
          <motion.div
            key="day"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <CalendarDayView
              events={events}
              currentDate={currentDate}
              onSelectEvent={onSelectEvent!}
              onDayChange={setCurrentDate}
            />
          </motion.div>
        )}

        {view === "agenda" && (
          <motion.div
            key="agenda"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <AgendaView
              events={events}
              currentMonth={currentDate}
              onSelectEvent={onSelectEvent!}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend - Only show on larger screens or month view */}
      {(!isMobile || view === "month") && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "flex flex-wrap items-center justify-center gap-2 md:gap-3 px-2 md:px-4",
            isMobile && "text-[10px]"
          )}
        >
          {Object.entries(statusConfig).map(([key, config]) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.05 }}
              className={cn(
                "flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl font-medium",
                "border transition-all cursor-default",
                isMobile ? "text-[9px]" : "text-xs",
                config.bg,
                config.border,
                config.text
              )}
            >
              <span className={isMobile ? "text-[10px]" : ""}>{config.icon}</span>
              <span>{config.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
