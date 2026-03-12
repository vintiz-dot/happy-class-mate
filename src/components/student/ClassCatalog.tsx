import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Calendar, Clock, User, Send, CheckCircle, Loader2 } from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ClassCatalogProps {
  studentId: string;
}

export function ClassCatalog({ studentId }: ClassCatalogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [message, setMessage] = useState("");

  // Fetch active classes with teacher info
  const { data: classes, isLoading } = useQuery({
    queryKey: ["class-catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name, schedule_template, default_teacher_id, default_session_length_minutes")
        .eq("is_active", true)
        .order("name");

      if (!data) return [];

      // Fetch teacher names for classes that have default teachers
      const teacherIds = [...new Set(data.filter(c => c.default_teacher_id).map(c => c.default_teacher_id!))];
      let teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from("teachers")
          .select("id, full_name")
          .in("id", teacherIds);
        teacherMap = Object.fromEntries((teachers || []).map(t => [t.id, t.full_name]));
      }

      return data.map(c => ({
        ...c,
        teacherName: c.default_teacher_id ? teacherMap[c.default_teacher_id] : null,
        slots: (c.schedule_template as any)?.weeklySlots || [],
      }));
    },
  });

  // Fetch existing requests to disable already-requested classes
  const { data: existingRequests } = useQuery({
    queryKey: ["enrollment-requests", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollment_requests" as any)
        .select("class_id, status")
        .eq("student_id", studentId)
        .in("status", ["pending"]);
      return (data as any[]) || [];
    },
    enabled: !!studentId,
  });

  const pendingClassIds = new Set((existingRequests || []).map((r: any) => r.class_id));

  const requestMutation = useMutation({
    mutationFn: async ({ classId, msg }: { classId: string; msg: string }) => {
      const { error } = await supabase
        .from("enrollment_requests" as any)
        .insert({
          student_id: studentId,
          class_id: classId,
          message: msg || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request Sent! 🎉", description: "The admin will review your request shortly." });
      queryClient.invalidateQueries({ queryKey: ["enrollment-requests", studentId] });
      setSelectedClass(null);
      setMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes?.map((cls, i) => {
          const isPending = pendingClassIds.has(cls.id);
          const uniqueDays = [...new Set(cls.slots.map((s: any) => s.dayOfWeek))].sort() as number[];

          return (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full hover:shadow-2xl transition-all duration-300 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="p-5 relative space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{cls.name}</h3>
                    {cls.teacherName && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <User className="h-3.5 w-3.5" />
                        {cls.teacherName}
                      </p>
                    )}
                  </div>

                  {/* Schedule */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Schedule
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueDays.map(day => (
                        <Badge key={day} variant="secondary" className="text-xs">
                          {DAY_NAMES[day]}
                        </Badge>
                      ))}
                    </div>
                    {cls.slots.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {cls.slots[0].startTime?.slice(0, 5)} – {cls.slots[0].endTime?.slice(0, 5)}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  {isPending ? (
                    <Button disabled className="w-full" variant="secondary" size="sm">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
                      size="sm"
                      onClick={() => setSelectedClass(cls)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Request to Join
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedClass} onOpenChange={() => { setSelectedClass(null); setMessage(""); }}>
        <DialogContent className="glass-lg border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Join {selectedClass?.name}? 🚀</DialogTitle>
            <DialogDescription>
              Send a request to the admin. They'll review it and get back to you!
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add a message (optional)..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedClass(null); setMessage(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => requestMutation.mutate({ classId: selectedClass.id, msg: message })}
              disabled={requestMutation.isPending}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
