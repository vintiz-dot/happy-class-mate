import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, User, ChevronRight, Sparkles } from "lucide-react";
import { dayjs } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getSessionDisplayStatus } from "@/lib/sessionStatus";

interface ClassSelectorProps {
  date: Date;
  sessions: any[];
  onSelectSession: (session: any) => void;
  onClose: () => void;
}

const getStatusStyle = (session: any) => {
  const displayStatus = getSessionDisplayStatus({
    date: session.date,
    start_time: session.start_time,
    status: session.status,
  });
  
  switch (displayStatus) {
    case "Held":
      return { bg: "bg-muted/60", border: "border-muted-foreground/20", icon: "✓" };
    case "Canceled":
      return { bg: "bg-destructive/10", border: "border-destructive/30", icon: "✕" };
    case "Holiday":
      return { bg: "bg-accent/10", border: "border-accent/30", icon: "🎉" };
    default:
      return { bg: "bg-success/10", border: "border-success/30", icon: "✨" };
  }
};

export default function ClassSelector({ date, sessions, onSelectSession, onClose }: ClassSelectorProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md glass-lg border-primary/10 overflow-hidden p-0">
        {/* Header with gradient */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Select Class
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {dayjs(date).format("dddd, MMMM D, YYYY")} • {sessions.length} {sessions.length === 1 ? 'class' : 'classes'}
            </p>
          </DialogHeader>
        </div>

        {/* Sessions list */}
        <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {sessions.map((session, index) => {
              const statusStyle = getStatusStyle(session);
              
              return (
                <motion.button
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border mb-3 transition-all duration-300",
                    "group cursor-pointer flex items-center justify-between",
                    "hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    statusStyle.bg,
                    statusStyle.border
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{statusStyle.icon}</span>
                      <h3 className="font-semibold text-foreground truncate">
                        {session.classes?.name}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                        </span>
                      </div>
                      
                      {session.teachers?.full_name && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[120px]">{session.teachers.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0.5, x: -5 }}
                    whileHover={{ opacity: 1, x: 0 }}
                    className="ml-3"
                  >
                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </motion.div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="w-full h-11 rounded-xl hover:bg-muted/50"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
