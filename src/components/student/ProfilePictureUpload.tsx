import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ProfilePictureUploadProps {
  studentId: string;
  currentAvatarUrl?: string | null;
  studentName: string;
}

export function ProfilePictureUpload({ 
  studentId, 
  currentAvatarUrl,
  studentName 
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file");
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be less than 5MB");
      }

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("student-avatars")
            .remove([`${studentId}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${studentId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("student-avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("student-avatars")
        .getPublicUrl(filePath);

      // Update student record
      const { error: updateError } = await supabase
        .from("students")
        .update({ avatar_url: publicUrl })
        .eq("id", studentId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      toast.success("Profile picture updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload profile picture");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  const initials = studentName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="h-32 w-32">
        <AvatarImage src={currentAvatarUrl || undefined} alt={studentName} />
        <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
      </Avatar>
      
      <div>
        <input
          type="file"
          id="avatar-upload"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <label htmlFor="avatar-upload">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => document.getElementById("avatar-upload")?.click()}
            asChild
          >
            <span>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </>
              )}
            </span>
          </Button>
        </label>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Maximum file size: 5MB<br />
        Supported formats: JPG, PNG, WEBP
      </p>
    </div>
  );
}
