import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap } from "lucide-react";

interface SessionTASelectorProps {
  selectedTAIds: string[];
  onChange: (ids: string[]) => void;
}

export function SessionTASelector({ selectedTAIds, onChange }: SessionTASelectorProps) {
  const { data: assistants = [] } = useQuery({
    queryKey: ["teaching-assistants-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assistants")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  if (assistants.length === 0) return null;

  const toggleTA = (id: string) => {
    if (selectedTAIds.includes(id)) {
      onChange(selectedTAIds.filter(i => i !== id));
    } else {
      onChange([...selectedTAIds, id]);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <GraduationCap className="h-4 w-4" />
        Teaching Assistants
      </Label>
      <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
        {assistants.map((ta) => (
          <label key={ta.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
            <Checkbox
              checked={selectedTAIds.includes(ta.id)}
              onCheckedChange={() => toggleTA(ta.id)}
            />
            <span className="text-sm">{ta.full_name}</span>
          </label>
        ))}
      </div>
      {selectedTAIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTAIds.map(id => {
            const ta = assistants.find(a => a.id === id);
            return ta ? (
              <Badge key={id} variant="secondary" className="text-xs">
                {ta.full_name}
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
