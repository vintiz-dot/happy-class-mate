import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, User } from "lucide-react";
import { dayjs } from "@/lib/date";

interface ClassSelectorProps {
  date: Date;
  sessions: any[];
  onSelectSession: (session: any) => void;
  onClose: () => void;
}

export default function ClassSelector({ date, sessions, onSelectSession, onClose }: ClassSelectorProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Class</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {dayjs(date).format("MMMM D, YYYY")} • {sessions.length} classes
          </p>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => {
                onSelectSession(session);
                onClose();
              }}
            >
              <div className="space-y-2">
                <div className="font-semibold">{session.classes?.name}</div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  
                  {session.teachers?.full_name && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{session.teachers.full_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Button variant="outline" onClick={onClose} className="w-full">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
