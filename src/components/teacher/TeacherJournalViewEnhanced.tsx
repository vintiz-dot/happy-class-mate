import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { JournalList } from "@/components/journal/JournalList";
import { JournalViewer } from "@/components/journal/JournalViewer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Student {
  id: string;
  full_name: string;
}

interface Class {
  id: string;
  name: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  student_id?: string;
  class_id?: string;
  is_private?: boolean;
}

export function TeacherJournalViewEnhanced() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"student" | "class" | "private">("student");
  const { toast } = useToast();

  useEffect(() => {
    loadStudents();
    loadClasses();
  }, [user]);

  const loadStudents = async () => {
    if (!user) return;
    
    // Get students enrolled in classes taught by this teacher
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!teacherData) return;

    // Get class IDs for this teacher
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("class_id")
      .eq("teacher_id", teacherData.id);

    if (!sessionData) return;

    const classIds = [...new Set(sessionData.map(s => s.class_id))];

    // Get students enrolled in those classes
    const { data: enrollmentData } = await supabase
      .from("enrollments")
      .select("student_id")
      .in("class_id", classIds);

    if (!enrollmentData) return;

    const studentIds = [...new Set(enrollmentData.map(e => e.student_id))];

    const { data, error } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("is_active", true)
      .in("id", studentIds)
      .order("full_name");

    if (error) {
      toast({
        title: "Error loading students",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setStudents(data || []);
    }
  };

  const loadClasses = async () => {
    if (!user) return;

    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!teacherData) return;

    // Get class IDs for this teacher
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("class_id")
      .eq("teacher_id", teacherData.id);

    if (!sessionData) return;

    const classIds = [...new Set(sessionData.map(s => s.class_id))];

    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .eq("is_active", true)
      .in("id", classIds)
      .order("name");

    if (error) {
      toast({
        title: "Error loading classes",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setClasses(data || []);
    }
  };

  const handleSave = () => {
    setIsCreating(false);
    setEditingId(null);
    setRefreshKey((k) => k + 1);
  };

  if (isCreating || editingId) {
    return (
      <JournalEditor
        studentId={activeTab === "student" ? selectedStudentId : undefined}
        classId={activeTab === "class" ? selectedClassId : undefined}
        isPrivate={activeTab === "private"}
        entryId={editingId || undefined}
        onSave={handleSave}
        onCancel={() => {
          setIsCreating(false);
          setEditingId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="student">Student Journals</TabsTrigger>
          <TabsTrigger value="class">Class Journals</TabsTrigger>
          <TabsTrigger value="private">Private Journals</TabsTrigger>
        </TabsList>

        <TabsContent value="student" className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedStudentId && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            )}
          </div>

          {selectedStudentId && (
            <>
              <JournalList
                key={refreshKey}
                studentId={selectedStudentId}
                onEdit={setEditingId}
                onView={setViewingEntry}
              />
              <JournalViewer entry={viewingEntry} onClose={() => setViewingEntry(null)} />
            </>
          )}
        </TabsContent>

        <TabsContent value="class" className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClassId && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Class Entry
              </Button>
            )}
          </div>

          {selectedClassId && (
            <>
              <JournalList
                key={refreshKey}
                classId={selectedClassId}
                onEdit={setEditingId}
                onView={setViewingEntry}
              />
              <JournalViewer entry={viewingEntry} onClose={() => setViewingEntry(null)} />
            </>
          )}
        </TabsContent>

        <TabsContent value="private" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Private Entry
            </Button>
          </div>
          <JournalList
            key={refreshKey}
            isPrivate={true}
            onEdit={setEditingId}
            onView={setViewingEntry}
          />
          <JournalViewer entry={viewingEntry} onClose={() => setViewingEntry(null)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
