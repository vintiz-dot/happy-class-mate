import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAvatarUrl } from "@/lib/avatars";

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
      <div className="relative group">
        <Avatar className="h-32 w-32 ring-4 ring-primary/10 transition-all group-hover:ring-primary/20">
          <AvatarImage src={getAvatarUrl(currentAvatarUrl) || undefined} alt={studentName} className="object-cover" />
          <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-primary/10">{initials}</AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="h-8 w-8 text-white" />
        </div>
      </div>
      
      <div className="w-full max-w-xs">
        <input
          type="file"
          id="avatar-upload"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <label htmlFor="avatar-upload" className="w-full">
          <Button
            type="button"
            variant="default"
            size="lg"
            disabled={uploading}
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="w-full font-semibold"
            asChild
          >
            <span>
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-2" />
                  Edit Profile Picture
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
