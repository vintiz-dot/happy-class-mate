import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ClassSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ClassSelector({ value, onChange }: ClassSelectorProps) {
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["teacher-classes"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      // Try teacher first
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      let classIds: string[] = [];

      if (teacher) {
        const { data: sessions } = await supabase
          .from("sessions")
          .select("class_id")
          .eq("teacher_id", teacher.id);

        classIds = [...new Set(sessions?.map(s => s.class_id) || [])];
      } else {
        // Try TA
        const { data: ta } = await supabase
          .from("teaching_assistants")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!ta) return [];

        const { data: spData } = await supabase
          .from("session_participants")
          .select("sessions!inner(class_id)")
          .eq("teaching_assistant_id", ta.id)
          .eq("participant_type", "teaching_assistant");

        classIds = [...new Set((spData || []).map((sp: any) => sp.sessions?.class_id).filter(Boolean))];
      }

      if (classIds.length === 0) return [];

      const { data: classes } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds)
        .eq("is_active", true)
        .order("name");

      return classes || [];
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading classes...</div>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="class-select">Filter by Class</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="class-select" className="w-full sm:w-[250px]">
          <SelectValue placeholder="Select a class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Classes</SelectItem>
          {classes.map((cls) => (
            <SelectItem key={cls.id} value={cls.id}>
              {cls.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
