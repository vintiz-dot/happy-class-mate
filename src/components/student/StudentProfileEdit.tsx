import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, User, Mail, Phone, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ProfilePictureUpload } from "./ProfilePictureUpload";
import { AvatarPicker } from "./AvatarPicker";

interface StudentProfileEditProps {
  studentId: string;
}

export function StudentProfileEdit({ studentId }: StudentProfileEditProps) {
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-profile-edit", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    email: student?.email || "",
    phone: student?.phone || "",
    date_of_birth: student?.date_of_birth || "",
  });

  // Update form when student data loads
  useState(() => {
    if (student) {
      setFormData({
        email: student.email || "",
        phone: student.phone || "",
        date_of_birth: student.date_of_birth || "",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("students")
        .update({
          email: data.email || null,
          phone: data.phone || null,
          date_of_birth: data.date_of_birth || null,
        })
        .eq("id", studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-profile-edit", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-account-info", studentId] });
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Choose Your Avatar
          </CardTitle>
          <CardDescription>Select from standard avatars or unlock premium ones by ranking top-3</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarPicker
            studentId={studentId}
            currentAvatarUrl={student?.avatar_url}
            onSelect={async (avatarUrl) => {
              const { error } = await supabase
                .from("students")
                .update({ avatar_url: avatarUrl })
                .eq("id", studentId);
              
              if (error) {
                toast.error("Failed to update avatar");
              } else {
                queryClient.invalidateQueries({ queryKey: ["student", studentId] });
                queryClient.invalidateQueries({ queryKey: ["student-profile-edit", studentId] });
                toast.success("Avatar updated successfully");
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Profile Picture Upload (Custom) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Custom Profile Picture
          </CardTitle>
          <CardDescription>Or upload your own custom picture</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfilePictureUpload
            studentId={studentId}
            currentAvatarUrl={student?.avatar_url}
            studentName={student?.full_name || "Student"}
          />
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact Information
          </CardTitle>
          <CardDescription>Update your contact details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="h-4 w-4 inline mr-2" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your.email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone className="h-4 w-4 inline mr-2" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">
                <Calendar className="h-4 w-4 inline mr-2" />
                Date of Birth
              </Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
