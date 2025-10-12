import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link, Unlink } from "lucide-react";

interface StudentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  currentUserId?: string;
}

export function StudentLinkDialog({ open, onOpenChange, studentId, studentName, currentUserId }: StudentLinkDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .order("created_at");
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('link-student-user', {
        body: { studentId, userId, action: 'link' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "User linked successfully" });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to link user", description: error.message, variant: "destructive" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('link-student-user', {
        body: { studentId, action: 'unlink' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "User unlinked successfully" });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      setSelectedUserId("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to unlink user", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link User to {studentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentUserId && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">Currently linked: {currentUserId}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
              >
                {unlinkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Select User</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : (
                  users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.id}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={() => linkMutation.mutate(selectedUserId)}
            disabled={!selectedUserId || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Link className="h-4 w-4 mr-2" />
            )}
            Link User
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
