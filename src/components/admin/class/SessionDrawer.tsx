import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Users } from "lucide-react";
import { format } from "date-fns";

interface SessionDrawerProps {
  session: any;
  students: any[];
  onClose: () => void;
  onEdit?: (session: any) => void;
}

const SessionDrawer = ({ session, students, onClose, onEdit }: SessionDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    return students.filter(s => 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-green-100 text-green-800';
      case 'Held': return 'bg-gray-100 text-gray-800';
      case 'Canceled': return 'bg-red-100 text-red-800';
      case 'Holiday': return 'bg-purple-100 text-purple-800';
      default: return 'bg-muted';
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Session Details</SheetTitle>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(session)}
              >
                Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(session.date), "EEEE, MMMM d, yyyy")}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
              </span>
            </div>

            {session.teacher && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{session.teacher.full_name}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Badge className={statusColor(session.status)}>
                {session.status}
              </Badge>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Enrolled Students ({students.length})
              </h3>
            </div>

            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-3"
            />

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium">{student.full_name}</div>
                  {student.enrolled_since && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Enrolled since {format(new Date(student.enrolled_since), "MMM d, yyyy")}
                    </div>
                  )}
                  {session.attendance_summary?.[student.id] && (
                    <Badge variant="outline" className="mt-2">
                      {session.attendance_summary[student.id]}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SessionDrawer;
