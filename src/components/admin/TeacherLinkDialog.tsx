import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TeacherLinkDialogProps {
  teacher: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TeacherLinkDialog({ teacher, onClose, onSuccess }: TeacherLinkDialogProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-for-teacher-link"],
    queryFn: async () => {
      const response = await supabase.functions.invoke("manage-admin-users", {
        body: { action: "listUsers" },
      });

      if (response.error) throw response.error;
      return response.data.users;
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("manage-admin-users", {
        body: { 
          action: "linkToTeacher", 
          userId: userId, 
          teacherId: teacher.id 
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-profile", teacher.id] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher linked to user successfully");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error("Failed to link teacher: " + error.message);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("teachers")
        .update({ user_id: null })
        .eq("id", teacher.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-profile", teacher.id] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher unlinked from user");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error("Failed to unlink teacher: " + error.message);
    },
  });

  const handleLink = () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }
    linkMutation.mutate(selectedUserId);
  };

  const handleUnlink = () => {
    if (window.confirm("Are you sure you want to unlink this teacher from the user account?")) {
      unlinkMutation.mutate();
    }
  };

  // Filter out already linked users
  const availableUsers = users?.filter((user: any) => {
    return !user.teacher || user.id === teacher.user_id;
  });

  // Find currently linked user
  const linkedUser = users?.find((user: any) => user.id === teacher.user_id);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Teacher to User Account</DialogTitle>
          <DialogDescription>
            Link this teacher to a registered user account for portal access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {teacher.user_id && linkedUser && (
            <Alert>
              <LinkIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Currently linked to:</strong> {linkedUser.email}
                    <div className="flex gap-1 mt-1">
                      {linkedUser.roles?.map((role: string) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={unlinkMutation.isPending}
                  >
                    Unlink
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="user-select">Select User to Link</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select">
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading users...
                  </SelectItem>
                ) : availableUsers && availableUsers.length > 0 ? (
                  availableUsers.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{user.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.id.slice(0, 8)}
                        </span>
                        {user.roles?.length > 0 && (
                          <div className="flex gap-1">
                            {user.roles.map((role: string) => (
                              <Badge key={role} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No available users
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Linking a teacher allows the user to access teacher portal features including class management, attendance marking, and assignment grading.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleLink} 
              disabled={!selectedUserId || linkMutation.isPending}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {linkMutation.isPending ? "Linking..." : "Link Teacher"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
