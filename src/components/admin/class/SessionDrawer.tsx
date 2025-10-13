import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Users, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface SessionDrawerProps {
  session: any;
  students: any[];
  onClose: () => void;
  onEdit?: (session: any) => void;
}

const SessionDrawer = ({ session, students, onClose, onEdit }: SessionDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: homework } = useQuery({
    queryKey: ["session-homework", session?.class_id],
    queryFn: async () => {
      if (!session?.class_id) return [];

      const { data } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          body,
          due_date,
          created_at,
          homework_files(id, file_name, storage_key, size_bytes)
        `)
        .eq("class_id", session.class_id)
        .order("created_at", { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!session?.class_id,
  });

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

  const attendanceColor = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'Absent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'Excused': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
      default: return 'bg-muted';
    }
  };

  const downloadFile = async (storageKey: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("homework")
      .download(storageKey);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
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

          {homework && homework.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4" />
                Recent Homework ({homework.length})
              </h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {homework.map((hw: any) => (
                  <div key={hw.id} className="p-3 border rounded-lg">
                    <div className="font-medium">{hw.title}</div>
                    {hw.due_date && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Due: {format(new Date(hw.due_date), "MMM d, yyyy")}
                      </div>
                    )}
                    {hw.homework_files && hw.homework_files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {hw.homework_files.map((file: any) => (
                          <Button
                            key={file.id}
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(file.storage_key, file.file_name)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {file.file_name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{student.full_name}</div>
                    {student.attendance_status && (
                      <Badge className={attendanceColor(student.attendance_status)}>
                        {student.attendance_status}
                      </Badge>
                    )}
                  </div>
                  {student.enrolled_since && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Enrolled since {format(new Date(student.enrolled_since), "MMM d, yyyy")}
                    </div>
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
