import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TeacherEditDrawerProps {
  teacher: any;
  onClose: () => void;
}

export function TeacherEditDrawer({ teacher, onClose }: TeacherEditDrawerProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [bio, setBio] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (teacher) {
      setFullName(teacher.full_name || "");
      setEmail(teacher.email || "");
      setPhone(teacher.phone || "");
      setHourlyRate(teacher.hourly_rate_vnd?.toString() || "");
      setBio(teacher.bio || "");
      setIsActive(teacher.is_active ?? true);
    }
  }, [teacher]);

  const handleSave = async () => {
    if (!teacher?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("teachers")
        .update({
          full_name: fullName,
          email,
          phone,
          hourly_rate_vnd: parseInt(hourlyRate),
          bio,
          is_active: isActive,
        })
        .eq("id", teacher.id);

      if (error) throw error;

      toast.success("Teacher updated successfully");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update teacher");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={!!teacher} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Teacher</SheetTitle>
          <SheetDescription>Update teacher information</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="hourlyRate">Hourly Rate (VND)</Label>
            <Input
              id="hourlyRate"
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active Status</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
