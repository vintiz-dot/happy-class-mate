import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Users, FileText, Download } from "lucide-react";
import { format } from "date-fns";

interface SessionDrawerProps {
  session: any;
  students: any[];
  onClose: () => void;
  onEdit?: (session: any) => void;
}

const SessionDrawer = ({ session, students, onClose, onEdit }: SessionDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch homework for this session's class
  const { data: homework } = useQuery({
    queryKey: ["session-homework", session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("homeworks")
        .select(`
          *,
          homework_files(*)
        `)
        .eq("class_id", session.class_id)
        .order("created_at", { ascending: false })
        .limit(5);

      return data || [];
    },
  });

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    return students.filter(s => 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'Held': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
      case 'Canceled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'Holiday': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      default: return 'bg-muted';
    }
  };

  const attendanceColor = (status?: string) => {
    switch (status) {
      case 'Present': return 'bg-green-500 text-white';
      case 'Absent': return 'bg-red-500 text-white';
      case 'Excused': return 'bg-gray-500 text-white';
      default: return 'bg-muted';
    }
  };

  const downloadFile = async (storageKey: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("homework")
        .download(storageKey);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
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
            {session.notes && (
              <div className="text-sm">
                <p className="font-medium mb-1">Notes:</p>
                <p className="text-muted-foreground">{session.notes}</p>
              </div>
            )}
          </div>

          {homework && homework.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Recent Homework
                </h3>
                {homework.map((hw: any) => (
                  <Card key={hw.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{hw.title}</p>
                          {hw.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(hw.due_date), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                      {hw.body && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{hw.body}</p>
                      )}
                      {hw.homework_files?.length > 0 && (
                        <div className="space-y-1">
                          {hw.homework_files.map((file: any) => (
                            <Button
                              key={file.id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start h-auto py-1 text-xs"
                              onClick={() => downloadFile(file.storage_key, file.file_name)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {file.file_name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          <Separator />
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
                    <Badge 
                      variant="outline" 
                      className={`mt-2 ${attendanceColor(session.attendance_summary[student.id])}`}
                    >
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
