import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, isSameDay, isPast, isBefore, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { dayjs } from "@/lib/date";
import ClassSelector from "@/components/schedule/ClassSelector";

const TIMEZONE = "Asia/Bangkok";

interface Session {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  classes: { name: string };
}

interface TeacherPayrollCalendarProps {
  sessions: Session[];
  hourlyRate: number;
  month: Date;
  onMonthChange: (date: Date) => void;
}

export default function TeacherPayrollCalendar({
  sessions,
  hourlyRate,
  month,
  onMonthChange,
}: TeacherPayrollCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showClassSelector, setShowClassSelector] = useState(false);

  const now = toZonedTime(new Date(), TIMEZONE);
  const today = startOfDay(now);

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const calculateSessionAmount = (session: Session) => {
    const startTime = dayjs(`${session.date} ${session.start_time}`);
    const endTime = dayjs(`${session.date} ${session.end_time}`);
    const hours = endTime.diff(startTime, "hour", true);
    return Math.round(hours * hourlyRate);
  };

  const getSessionsForDate = (date: Date) => {
    return sessions.filter((s) =>
      isSameDay(new Date(s.date), date)
    );
  };

  const getSessionStatus = (session: Session) => {
    // Parse session date and time to check if it's truly in the past
    const sessionDateTime = new Date(`${session.date}T${session.start_time}`);
    const nowBangkok = toZonedTime(new Date(), TIMEZONE);
    
    // If session datetime is in future, always show as Scheduled
    if (sessionDateTime > nowBangkok) {
      return "Scheduled";
    }
    // Past sessions: use actual status
    return session.status;
  };

  const handleDateClick = (date: Date) => {
    const dateSessions = getSessionsForDate(date);
    if (dateSessions.length > 1) {
      setSelectedDate(date);
      setShowClassSelector(true);
    } else if (dateSessions.length === 1) {
      // Navigate to schedule with this session
      window.location.href = `/schedule?date=${format(date, "yyyy-MM-dd")}`;
    }
  };

  const handleSelectSession = (session: Session) => {
    window.location.href = `/schedule?date=${session.date}`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Calendar View</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onMonthChange(subMonths(month, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-lg font-semibold min-w-[150px] text-center">
                {format(month, "MMMM yyyy")}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onMonthChange(addMonths(month, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            
            {/* Pad to start on correct day */}
            {Array.from({ length: startOfMonth(month).getDay() }).map((_, idx) => (
              <div key={`pad-${idx}`} className="min-h-[80px]" />
            ))}
            
            {days.map((day, index) => {
              const dateSessions = getSessionsForDate(day);
              const heldSessions = dateSessions.filter(s => getSessionStatus(s) === "Held");
              const totalEarned = heldSessions.reduce((sum, s) => sum + calculateSessionAmount(s), 0);
              
              return (
                <button
                  key={index}
                  onClick={() => dateSessions.length > 0 && handleDateClick(day)}
                  className={`
                    min-h-[80px] p-2 border rounded-lg text-left transition-all
                    ${!isSameMonth(day, month) ? "opacity-30" : ""}
                    ${isToday(day) ? "border-primary border-2" : ""}
                    ${dateSessions.length > 0 ? "hover:shadow-md cursor-pointer bg-muted/50" : ""}
                  `}
                  disabled={dateSessions.length === 0}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday(day) ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  
                  {dateSessions.length > 0 && (
                    <div className="space-y-1">
                      {dateSessions.slice(0, 2).map((session) => {
                        const displayStatus = getSessionStatus(session);
                        return (
                          <div
                            key={session.id}
                            className="text-xs p-1 rounded bg-background border"
                          >
                            <div className="font-medium truncate">{session.classes.name}</div>
                            <div className="text-muted-foreground">
                              {session.start_time.slice(0, 5)}
                            </div>
                            <Badge
                              variant={displayStatus === "Held" ? "default" : "secondary"}
                              className="text-[10px] px-1 py-0 mt-1"
                            >
                              {displayStatus}
                            </Badge>
                          </div>
                        );
                      })}
                      {dateSessions.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dateSessions.length - 2} more
                        </div>
                      )}
                      {totalEarned > 0 && (
                        <div className="text-xs font-semibold text-success mt-1">
                          {totalEarned.toLocaleString()} ₫
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {showClassSelector && selectedDate && (
        <ClassSelector
          date={selectedDate}
          sessions={getSessionsForDate(selectedDate)}
          onSelectSession={handleSelectSession}
          onClose={() => {
            setShowClassSelector(false);
            setSelectedDate(null);
          }}
        />
      )}
    </>
  );
}
