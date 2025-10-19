import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link, Unlink, AlertTriangle, Mail, UserCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StudentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  currentUserId?: string;
  currentUserEmail?: string;
}

interface UserWithRole {
  id: string;
  email: string;
  roles: string[];
  created_at: string;
  isLinked?: boolean;
  linkedStudentName?: string;
}

export function StudentLinkDialog({ 
  open, 
  onOpenChange, 
  studentId, 
  studentName, 
  currentUserId,
  currentUserEmail 
}: StudentLinkDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId || "");
  const [updateFamilyEmail, setUpdateFamilyEmail] = useState(true);
  const [allowReassign, setAllowReassign] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showReassignConfirm, setShowReassignConfirm] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<{ userId: string; currentStudent: string } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && currentUserId) {
      setSelectedUserId(currentUserId);
    }
  }, [open, currentUserId]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles-for-linking"],
    queryFn: async () => {
      // Get all users with roles
      const response = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'listUsers' }
      });

      if (response.error) throw response.error;
      
      // Get linked students info
      const { data: linkedStudents } = await supabase
        .from('students')
        .select('id, full_name, linked_user_id')
        .not('linked_user_id', 'is', null);

      const linkedMap = new Map(
        linkedStudents?.map(s => [s.linked_user_id, s.full_name]) || []
      );

      const usersWithLinkInfo: UserWithRole[] = response.data.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        roles: u.roles || [],
        created_at: u.created_at,
        isLinked: linkedMap.has(u.id) && linkedMap.get(u.id) !== studentName,
        linkedStudentName: linkedMap.get(u.id)
      }));

      return usersWithLinkInfo;
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async ({ userId, allowReassign }: { userId: string; allowReassign: boolean }) => {
      const { data, error } = await supabase.functions.invoke('link-student-user', {
        body: { 
          studentId, 
          userId, 
          action: 'link',
          updateFamilyEmail,
          allowReassign
        }
      });
      
      if (error) throw error;
      if (data?.error) {
        if (data.requiresReassign) {
          throw { requiresReassign: true, currentStudent: data.currentStudent };
        }
        throw new Error(data.error);
      }
      return data;
    },
    onSuccess: (data) => {
      let message = "User linked successfully";
      if (data?.siblingsLinked && data.siblingsLinked > 0) {
        message += ` (${data.siblingsLinked} sibling${data.siblingsLinked > 1 ? 's' : ''} also linked)`;
      }
      
      if (data?.warning) {
        toast({ 
          title: message, 
          description: data.warning,
          variant: "default"
        });
      } else {
        toast({ title: message });
      }
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles-for-linking"] });
      onOpenChange(false);
      setAllowReassign(false);
    },
    onError: (error: any) => {
      if (error.requiresReassign) {
        setReassignTarget({ userId: selectedUserId, currentStudent: error.currentStudent });
        setShowReassignConfirm(true);
      } else {
        toast({ 
          title: "Failed to link user", 
          description: error.message, 
          variant: "destructive" 
        });
      }
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('link-student-user', {
        body: { studentId, action: 'unlink' }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "User unlinked successfully" });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles-for-linking"] });
      setSelectedUserId("");
      setShowUnlinkConfirm(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to unlink user", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleLink = () => {
    if (!selectedUserId) {
      toast({ 
        title: "No user selected", 
        description: "Please select a user to link",
        variant: "destructive" 
      });
      return;
    }
    linkMutation.mutate({ userId: selectedUserId, allowReassign });
  };

  const handleReassignConfirm = () => {
    if (reassignTarget) {
      setAllowReassign(true);
      setShowReassignConfirm(false);
      linkMutation.mutate({ userId: reassignTarget.userId, allowReassign: true });
    }
  };

  const filteredUsers = users?.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'teacher': return 'default';
      case 'student': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect User to {studentName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {currentUserId && currentUserEmail && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Currently linked user</p>
                    <p className="text-sm text-muted-foreground">{currentUserEmail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">ID: {currentUserId.substring(0, 8)}...</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUnlinkConfirm(true)}
                  disabled={unlinkMutation.isPending}
                >
                  {unlinkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 mr-2" />
                      Unlink
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <Label>Search and Select User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <div className="p-2 space-y-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        disabled={user.isLinked && !allowReassign}
                        className={`w-full text-left p-3 rounded-md transition-colors ${
                          selectedUserId === user.id
                            ? 'bg-primary text-primary-foreground'
                            : user.isLinked && !allowReassign
                            ? 'bg-muted/50 opacity-50 cursor-not-allowed'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <p className="text-sm font-medium truncate">{user.email}</p>
                            </div>
                            <p className="text-xs opacity-70 truncate">ID: {user.id}</p>
                            {user.isLinked && (
                              <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Linked to: {user.linkedStudentName}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {user.roles.map((role) => (
                              <Badge 
                                key={role} 
                                variant={getRoleBadgeVariant(role)}
                                className="text-xs"
                              >
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      {searchQuery ? 'No users found matching your search' : 'No users available'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateFamilyEmail"
                  checked={updateFamilyEmail}
                  onCheckedChange={(checked) => setUpdateFamilyEmail(checked as boolean)}
                />
                <Label
                  htmlFor="updateFamilyEmail"
                  className="text-sm font-normal cursor-pointer"
                >
                  Update family email with linked user's email (if empty)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowReassign"
                  checked={allowReassign}
                  onCheckedChange={(checked) => setAllowReassign(checked as boolean)}
                />
                <Label
                  htmlFor="allowReassign"
                  className="text-sm font-normal cursor-pointer"
                >
                  Allow reassigning user from another student
                </Label>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleLink}
              disabled={!selectedUserId || linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Linking...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Connect User
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation */}
      <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Unlink</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink {currentUserEmail} from {studentName}? 
              This will remove the student's login access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlinkMutation.mutate()}>
              Unlink User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign Confirmation */}
      <AlertDialog open={showReassignConfirm} onOpenChange={setShowReassignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Reassignment</AlertDialogTitle>
            <AlertDialogDescription>
              This user is currently linked to <strong>{reassignTarget?.currentStudent}</strong>.
              {' '}Linking them to {studentName} will automatically unlink them from their current student.
              {' '}Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReassignTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReassignConfirm}>
              Reassign User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}