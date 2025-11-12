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

      // Get teacher ID
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (!teacher) return [];

      // Get unique class IDs where this teacher has sessions
      const { data: sessions } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      if (!sessions || sessions.length === 0) return [];

      const classIds = [...new Set(sessions.map(s => s.class_id))];

      // Get class details for only those classes
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
