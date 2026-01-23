import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayjs } from "@/lib/date";

interface MiniCalendarProps {
  currentMonth: dayjs.Dayjs;
  selectedDate?: string;
  eventDates?: Set<string>;
  onSelectDate: (date: string) => void;
  onChangeMonth: (month: dayjs.Dayjs) => void;
  className?: string;
}

export default function MiniCalendar({
  currentMonth,
  selectedDate,
  eventDates = new Set(),
  onSelectDate,
  onChangeMonth,
  className,
}: MiniCalendarProps) {
  const { cells, weekdays } = useMemo(() => {
    const start = currentMonth.startOf("month").startOf("isoWeek");
    const end = currentMonth.endOf("month").endOf("isoWeek");
    const cells: dayjs.Dayjs[] = [];
    let current = start;

    while (current.isBefore(end) || current.isSame(end, "day")) {
      cells.push(current);
      current = current.add(1, "day");
    }

    const weekdays = ["M", "T", "W", "T", "F", "S", "S"];
    return { cells, weekdays };
  }, [currentMonth]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className={cn(
        "glass-sm rounded-2xl p-3 w-[240px]",
        "shadow-xl border border-border/50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChangeMonth(currentMonth.subtract(1, "month"))}
          className="h-7 w-7 rounded-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <motion.span
          key={currentMonth.format("YYYY-MM")}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold"
        >
          {currentMonth.format("MMM YYYY")}
        </motion.span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChangeMonth(currentMonth.add(1, "month"))}
          className="h-7 w-7 rounded-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((day, idx) => (
          <div
            key={idx}
            className={cn(
              "text-center text-[10px] font-medium py-1",
              idx >= 5 ? "text-muted-foreground/50" : "text-muted-foreground"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        <AnimatePresence mode="wait">
          {cells.map((date) => {
            const dateStr = date.format("YYYY-MM-DD");
            const isCurrentMonth = date.isSame(currentMonth, "month");
            const isToday = date.isSame(dayjs(), "day");
            const isSelected = selectedDate === dateStr;
            const hasEvent = eventDates.has(dateStr);

            return (
              <motion.button
                key={dateStr}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectDate(dateStr)}
                className={cn(
                  "relative h-7 w-7 rounded-lg text-xs font-medium transition-all",
                  "flex items-center justify-center",
                  isCurrentMonth
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground/40",
                  isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                  isSelected && "bg-primary text-primary-foreground shadow-md"
                )}
              >
                {date.format("D")}
                {hasEvent && !isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Quick actions */}
      <div className="mt-3 pt-2 border-t border-border/50 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const today = dayjs();
            onChangeMonth(today);
            onSelectDate(today.format("YYYY-MM-DD"));
          }}
          className="flex-1 h-7 text-xs rounded-lg"
        >
          Today
        </Button>
      </div>
    </motion.div>
  );
}
