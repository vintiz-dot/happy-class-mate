import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ClassesList() {
  const queryClient = useQueryClient();
  
  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          *,
          teachers:default_teacher_id(full_name)
        `)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase
        .from("classes")
        .update({ is_active: false })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete class: " + error.message);
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {classes?.map((cls: any) => {
        const slots = cls.schedule_template?.weeklySlots || [];
        const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        
        return (
          <Card key={cls.id}>
            <CardHeader>
              <CardTitle className="text-lg">{cls.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{cls.teachers?.full_name}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {(cls.session_rate_vnd / 1000).toLocaleString()}k VND/buổi
                </Badge>
              </div>

              <div className="space-y-1">
                {slots.map((slot: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{days[slot.dayOfWeek]}</span>
                    <Clock className="h-4 w-4 ml-2" />
                    <span>{slot.startTime} - {slot.endTime}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Class</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {cls.name}? This will mark it as inactive.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(cls.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
